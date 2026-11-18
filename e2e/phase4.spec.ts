import { createClient } from '@supabase/supabase-js'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { gstinCheckChar } from '../src/lib/gstin'

// Phase 4 flow (local stack only): add sensor -> post readings with curl -> live tile -> push a reading out of range -> alert opens ->
// acknowledge -> resolve -> client temperature report PDF (and the evidence pack PDF).
function env(): { url: string; key: string } {
  const text = fs.readFileSync('.env.local', 'utf8')
  const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(text)?.[1].trim() ?? ''
  const url = get('VITE_SUPABASE_URL')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error('The e2e flow only runs against the local Supabase stack')
  return { url, key: get('VITE_SUPABASE_ANON_KEY') }
}
const { url: API, key: ANON } = env()
const INGEST = `${API}/functions/v1/ingest-reading`
const ADMIN = { email: 'admin@warehouse.local', password: 'Admin@12345' }
const run = Date.now().toString(36)
const CLIENT_NAME = `Chill Foods ${run}`
const CLIENT = { email: `chill-${run}@e2e.test`, temp: 'Temp-Pass-1234', next: 'E2e-Client-5678' }
const SERIAL = `E2E-FRZ-${run}`.toUpperCase()
const state = { wh: { id: '', code: '' }, zoneId: '', clientId: '', key: '' }

function gstin(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const r = parseInt(run, 36) % 2 ** 31
  const pick = (shift: number) => letters[Math.floor(r / 2 ** shift) % 24]
  const pan = `${pick(2)}${pick(5)}${pick(8)}CT${String(r % 10000).padStart(4, '0')}${pick(11)}`
  const first14 = `33${pan}1Z`
  return first14 + gstinCheckChar(first14)
}
function sql(statement: string) {
  const db = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' }).split('\n').find((n) => n.startsWith('supabase_db_'))
  if (!db) throw new Error('Local Supabase database container not found')
  return execFileSync('docker', ['exec', '-i', db, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA', '-c', statement], { encoding: 'utf8' }).trim()
}
/** POST readings the way a device would, with curl; returns [http status, body]. */
function curl(key: string, readings: unknown): [number, string] {
  const out = execFileSync('curl', ['-s', '-w', '\n%{http_code}', '-X', 'POST', INGEST, '-H', `X-Device-Key: ${key}`, '-H', 'Content-Type: application/json', '-d', JSON.stringify({ readings })], { encoding: 'utf8' })
  const i = out.lastIndexOf('\n')
  return [Number(out.slice(i + 1)), out.slice(0, i)]
}
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
async function adminApi() {
  const sb = createClient(API, ANON, { auth: { persistSession: false } })
  const { error } = await sb.auth.signInWithPassword(ADMIN)
  if (error) throw error
  return sb
}
async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Password').fill(who.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
}
const toast = (page: Page, text: string | RegExp) => expect(page.locator('[data-sonner-toast]').filter({ hasText: text }).first()).toBeVisible()
async function selectMatching(select: Locator, re: RegExp) {
  await expect.poll(async () => await select.locator('option').evaluateAll((opts, src) => (opts as HTMLOptionElement[]).some((o) => new RegExp(src).test(o.textContent ?? '')), re.source), { timeout: 15_000 }).toBe(true)
  const value = await select.locator('option').evaluateAll((opts, src) => (opts as HTMLOptionElement[]).find((o) => new RegExp(src).test(o.textContent ?? ''))?.value ?? null, re.source)
  await select.selectOption(value as string)
}

test.describe.serial('Phase 4: sensor -> readings -> live tile -> excursion -> alert -> report', () => {
  test.beforeAll(async () => {
    const sb = await adminApi()
    let wh: { id: string; code: string } | null = null
    for (let i = 0; i < 30 && !wh; i++) {
      const { data } = await sb.from('warehouses').insert({ code: `C${Math.floor(Math.random() * 90 + 10)}`, name: `Cold Hub ${run}`, city: 'Chennai' }).select('id, code').single()
      if (data) wh = data
    }
    if (!wh) throw new Error('Could not create a warehouse (run `npx supabase db reset`)')
    state.wh = wh
    const zone = await sb.from('zones').insert({ warehouse_id: wh.id, code: 'F1', name: 'Freezer one', storage_type: 'FROZEN', temp_min: -25, temp_max: -18 }).select('id').single()
    state.zoneId = zone.data!.id
    const bt = await sb.from('brigade_types').select('id').eq('is_default', true).single()
    const slots = await sb.rpc('create_brigade_slots', { p_zone_id: state.zoneId, p_brigade_type_id: bt.data!.id, p_aisles: 1, p_racks: 2, p_levels: 1, p_slots_per_level: 1, p_aisle_start: 1 })
    if (slots.error) throw slots.error
    const slot = await sb.from('brigade_slots').select('id, code').eq('zone_id', state.zoneId).limit(1).single()
    const client = await sb.from('clients').insert({ company_name: CLIENT_NAME, gstin: gstin(), email: `ops-${run}@e2e.test` }).select('id').single()
    if (client.error) throw client.error
    state.clientId = client.data.id
    await sb.from('contracts').insert({ client_id: state.clientId, warehouse_id: wh.id, start_date: '2020-01-01', status: 'ACTIVE' })
    // stock arrived yesterday (infrastructure of earlier phases, written directly)
    sql(`insert into public.slot_allocations (client_id, warehouse_id, zone_id, slot_id, brigade_type_id, start_date) values ('${state.clientId}', '${wh.id}', '${state.zoneId}', '${slot.data!.id}', '${bt.data!.id}', public.today_ist() - 1);
         insert into public.stock_items (client_id, warehouse_id, zone_id, slot_id, slot_code, item_name, unit, quantity, batch_no, received_at) values ('${state.clientId}', '${wh.id}', '${state.zoneId}', '${slot.data!.id}', '${slot.data!.code}', 'Frozen peas', 'BOX', 40, 'BATCH-${run.toUpperCase()}', now() - interval '1 day')`)
    const { error } = await sb.functions.invoke('create-user', { body: { email: CLIENT.email, password: CLIENT.temp, full_name: 'Chill Client', role: 'CLIENT', warehouse_ids: [], client_id: state.clientId } })
    if (error) throw new Error('create-user failed')
  })

  test('admin registers a sensor and creates its device key (shown once)', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/sensors')
    await page.getByRole('button', { name: 'Add sensor' }).click()
    await selectMatching(page.getByLabel('Zone', { exact: true }), new RegExp(`^${state.wh.code} · F1`))
    await page.getByLabel('Name', { exact: true }).fill('Freezer one probe')
    await page.getByLabel('Serial number').fill(SERIAL)
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
    await toast(page, 'Saved')
    const row = page.getByRole('row').filter({ hasText: SERIAL })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Never reported')
    await row.getByRole('button', { name: 'Keys' }).click()
    await page.getByRole('button', { name: 'New key for this sensor' }).click()
    const key = (await page.getByTestId('key-value').textContent())!.trim()
    expect(key).toMatch(/^wms_[0-9a-f]{48}$/)
    await expect(page.getByTestId('curl-sample')).toContainText(`"sensor":"${SERIAL}"`)
    await expect(page.getByTestId('curl-sample')).toContainText('X-Device-Key')
    state.key = key
    // only the hash is stored
    const sb = await adminApi()
    const keys = await sb.from('device_keys').select('key_prefix, key_hash').eq('sensor_id', (await sb.from('sensors').select('id').eq('serial_no', SERIAL).single()).data!.id)
    expect(keys.data![0].key_prefix).toBe(key.slice(0, 8))
    expect(keys.data![0].key_hash).not.toContain(key)
  })

  test('readings posted with curl are validated, and the zone tile goes live without a refresh', async ({ page }) => {
    // the ingest endpoint refuses what it should
    expect(curl('wms_wrong', [{ sensor: SERIAL, value: -20 }])[0]).toBe(401)
    const bad = curl(state.key, [{ sensor: 'NO-SUCH', value: -20 }])
    expect(bad[0]).toBe(422)
    expect(curl(state.key, [{ sensor: SERIAL, value: 500, timestamp: minutesAgo(1) }])[0]).toBe(422)
    expect(curl(state.key, [{ sensor: SERIAL, value: -20, timestamp: new Date(Date.now() + 3_600_000).toISOString() }])[0]).toBe(422)
    // 40 minutes of in-range history in one batch (offline buffering), with one bad row
    const history = Array.from({ length: 30 }, (_, i) => ({ sensor: SERIAL, value: -20.5 + (i % 3) * 0.2, unit: 'C', timestamp: minutesAgo(40 - i) }))
    const [status, body] = curl(state.key, [...history, { sensor: SERIAL, value: 'x' }])
    expect(status).toBe(400)                                              // the request itself is malformed ("value" is not a number)
    const [ok, okBody] = curl(state.key, history)
    expect(ok).toBe(200)
    expect(JSON.parse(okBody)).toMatchObject({ accepted: 30, duplicates: 0 })
    expect(JSON.parse(curl(state.key, history)[1])).toMatchObject({ accepted: 0, duplicates: 30 })   // idempotent
    void body

    await login(page, ADMIN)
    await page.goto('/cold-chain')
    await selectMatching(page.getByLabel('Warehouse', { exact: true }), new RegExp(`^${state.wh.code} `))
    const tile = page.getByTestId('tile-F1')
    await expect(tile).toBeVisible()
    await expect(tile).toHaveAttribute('data-status', 'OK')
    await expect(tile.getByTestId('tile-value')).toContainText('-20')
    await expect(tile.getByTestId('tile-updated')).toContainText('Updated')
    // a new reading arrives while the page stays open: the tile changes by itself
    expect(curl(state.key, [{ sensor: SERIAL, value: -19.1, timestamp: minutesAgo(0) }])[0]).toBe(200)
    await expect(tile.getByTestId('tile-value')).toContainText('-19.1', { timeout: 20_000 })
  })

  test('an excursion opens a CRITICAL alert listing the affected client and batch; acknowledge, then resolve', async ({ page }) => {
    // time moves on: everything received so far is now 15 minutes old, then the zone runs 9 C above its limit for 12 minutes
    sql(`update public.readings set recorded_at = recorded_at - interval '15 minutes' where sensor_id = (select id from public.sensors where serial_no = '${SERIAL}');
         update public.sensors set last_seen_at = last_seen_at - interval '15 minutes' where serial_no = '${SERIAL}'`)
    const hot = Array.from({ length: 12 }, (_, i) => ({ sensor: SERIAL, value: -9, timestamp: minutesAgo(11 - i) }))
    expect(curl(state.key, hot)[0]).toBe(200)
    sql('select public.evaluate_alerts()')                                // the engine runs every minute by pg_cron; run it now
    await login(page, ADMIN)
    await page.goto('/cold-chain')
    await selectMatching(page.getByLabel('Warehouse', { exact: true }), new RegExp(`^${state.wh.code} `))
    await expect(page.getByTestId('tile-F1')).toHaveAttribute('data-status', 'CRITICAL', { timeout: 20_000 })
    await page.goto('/alerts')
    const row = page.getByTestId('alert-row').filter({ hasText: 'Temperature too high' }).first()
    await expect(row).toContainText('Critical')
    await row.getByRole('button').first().click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog.getByTestId('affected-stock')).toContainText(CLIENT_NAME)
    await expect(dialog.getByTestId('affected-stock')).toContainText(`BATCH-${run.toUpperCase()}`)
    await expect(dialog.getByTestId('client-notice').first()).toContainText('Waiting for approval')
    await dialog.getByRole('button', { name: 'Acknowledge' }).click()
    await toast(page, 'Alert acknowledged')
    await expect(dialog).toContainText('Acknowledged')
    // evidence pack
    const [pack] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Evidence pack (PDF)' }).click()])
    const packBytes = fs.readFileSync((await pack.path())!)
    expect(packBytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(packBytes.length).toBeGreaterThan(3000)
    // resolve needs a cause and an action
    await dialog.getByRole('button', { name: 'Resolve', exact: true }).click()
    const resolve = page.getByRole('dialog').filter({ hasText: 'Resolve alert' }).last()
    await expect(resolve.getByRole('button', { name: 'Resolve', exact: true })).toBeDisabled()
    await resolve.getByLabel('Cause').fill('Door left open during loading')
    await resolve.getByLabel('Action taken').fill('Door closed, temperature recovered, stock checked')
    await resolve.getByRole('button', { name: 'Resolve', exact: true }).click()
    await toast(page, 'Alert resolved')
    await expect(dialog).toContainText('Door left open during loading')
    // approve the client notice wording
    await dialog.getByRole('button', { name: 'Review and approve' }).click()
    await page.getByRole('dialog').filter({ hasText: 'Subject' }).last().getByRole('button', { name: 'Approve and send' }).click()
    await toast(page, 'Saved')
    await expect(dialog.getByTestId('client-notice').first()).toContainText('Approved and sent')
    const sb = await adminApi()
    const queued = await sb.from('notification_outbox').select('to_address').eq('to_address', `ops-${run}@e2e.test`)
    expect(queued.data).toHaveLength(1)
  })

  test('the client temperature report PDF covers exactly the period and zone of the stock', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/cold-reports')
    await selectMatching(page.getByLabel('Client', { exact: true }), new RegExp(CLIENT_NAME))
    await page.getByRole('button', { name: 'Run report' }).click()
    const table = page.getByTestId('client-report')
    await expect(table).toContainText('F1 · Freezer one')
    await expect(table).toContainText('-20.5')                          // minimum of the posted readings (-20.5 to -9)
    await expect(table).toContainText('-9')                             // maximum
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()])
    expect(pdf.suggestedFilename()).toMatch(/^temperature-report-.*\.pdf$/)
    const bytes = fs.readFileSync((await pdf.path())!)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(2500)
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()])
    expect(fs.readFileSync((await csv.path())!, 'utf8')).toContain('Freezer one')
  })

  test('the client sees only its own report and only readings from the days its stock was there', async ({ page }) => {
    await login(page, { email: CLIENT.email, password: CLIENT.temp })
    await page.getByLabel('Current password').fill(CLIENT.temp)
    await page.getByLabel('New password', { exact: true }).fill(CLIENT.next)
    await page.getByLabel('Confirm new password').fill(CLIENT.next)
    await page.getByRole('button', { name: 'Update password' }).click()
    await toast(page, 'Password updated')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Temperature Reports' })).toBeVisible()
    for (const hidden of ['Live Cold Chain', 'Sensors', 'Alerts', 'Alert Rules', 'Equipment']) await expect(nav.getByRole('link', { name: hidden })).toHaveCount(0)
    await page.goto('/cold-chain')
    await expect(page.getByText('Not allowed')).toBeVisible()
    await page.goto('/cold-reports')
    await expect(page.getByLabel('Client', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Run report' }).click()
    await expect(page.getByTestId('client-report')).toContainText('F1 · Freezer one')

    const sb = createClient(API, ANON, { auth: { persistSession: false } })
    await sb.auth.signInWithPassword({ email: CLIENT.email, password: CLIENT.next })
    const readings = await sb.from('readings').select('recorded_at', { count: 'exact', head: true })
    expect(readings.count).toBeGreaterThan(30)
    expect((await sb.from('sensors').select('id')).data).toHaveLength(0)
    expect((await sb.from('device_keys').select('id')).data).toHaveLength(0)
    expect((await sb.from('alerts').select('id')).data!.length).toBeGreaterThan(0)       // its own stock was affected
    const insert = await sb.from('readings').insert({ sensor_id: '00000000-0000-0000-0000-000000000000', recorded_at: new Date().toISOString(), value: 1, raw_value: 1 })
    expect(insert.error).not.toBeNull()
  })

  test('staff enter a manual reading on a phone, and every cold-chain page opens without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await login(page, ADMIN)
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/manual-reading')
    await selectMatching(page.getByLabel('Zone', { exact: true }), new RegExp(`^${state.wh.code} · F1`))
    await page.getByLabel('Temperature', { exact: true }).fill('9')            // the minus toggle is on by default: -9 is out of range
    await expect(page.getByTestId('manual-outside')).toBeVisible()
    await page.getByLabel('Temperature', { exact: true }).fill('20')
    await expect(page.getByTestId('manual-outside')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save reading' }).click()
    await toast(page, 'Reading saved')
    await expect(page.getByText('-20 °C').first()).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 900 })
    for (const path of ['/alert-rules', '/equipment', '/cold-reports', `/cold-chain/zones/${state.zoneId}`, '/sensors', '/alerts']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
    await page.goto('/cold-reports')
    for (const tab of ['Excursions', 'Daily log sheet', 'Calibration register', 'Alert register']) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(300)
    }
    await page.goto(`/cold-chain/zones/${state.zoneId}`)
    await expect(page.getByTestId('zone-chart')).toBeVisible()
    await expect(page.getByTestId('chart-updated')).toContainText('Updated')
    expect(errors).toEqual([])
    // the manual reading is a sensor of its own, so it also reaches the alert engine and the reports
    expect(sql(`select count(*) from public.readings r join public.sensors s on s.id = r.sensor_id where s.zone_id = '${state.zoneId}' and r.source = 'MANUAL'`)).toBe('1')
  })
})
