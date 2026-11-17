import { createClient } from '@supabase/supabase-js'
import { expect, test, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import { gstinCheckChar } from '../src/lib/gstin'

// ---------- environment (local Supabase only) ----------
function env(): { url: string; key: string } {
  const text = fs.readFileSync('.env.local', 'utf8')
  const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(text)?.[1].trim() ?? ''
  const url = get('VITE_SUPABASE_URL')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error('The e2e flow only runs against the local Supabase stack')
  return { url, key: get('VITE_SUPABASE_ANON_KEY') }
}
const { url: API, key: ANON } = env()

// The seeded LOCAL admin (supabase/seed.sql). Never exists on the hosted project.
const ADMIN = { email: 'admin@warehouse.local', password: 'Admin@12345' }

const run = Date.now().toString(36)
const CLIENT_NAME = `E2E Foods ${run}`
const CLIENT_LOGIN = { email: `client-${run}@e2e.test`, temp: 'Temp-Pass-1234', next: 'E2e-Client-5678' }
const SKU = `FRZ-${run}`.toUpperCase()
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** A syntactically valid GSTIN (right check character) that is unique per run. */
function gstin(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const r = parseInt(run, 36) % 2 ** 31
  const pick = (shift: number) => letters[Math.floor(r / 2 ** shift) % 24]
  const pan = `${pick(0)}${pick(3)}${pick(6)}CT${String(r % 10000).padStart(4, '0')}${pick(9)}`
  const first14 = `33${pan}1Z`
  return first14 + gstinCheckChar(first14)
}

const state: { warehouse: { id: string; code: string; name: string }; gstin: string; receiptNo?: string; challanNo?: string } = {
  warehouse: { id: '', code: '', name: '' },
  gstin: gstin(),
}

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
async function logout(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
}
const toast = (page: Page, text: string | RegExp) => expect(page.locator('[data-sonner-toast]').filter({ hasText: text }).first()).toBeVisible()
/** Select the <option> whose text matches (Playwright cannot select by regular expression). */
async function selectMatching(select: Locator, re: RegExp) {
  const value = await select.locator('option').evaluateAll((opts, src) => {
    const r = new RegExp(src)
    return (opts as HTMLOptionElement[]).find((o) => r.test(o.textContent ?? ''))?.value ?? null
  }, re.source)
  if (value === null) throw new Error(`No option matching ${re}`)
  await select.selectOption(value)
}
async function pickWarehouse(page: Page, label = 'Warehouse') {
  const sel = page.getByLabel(label, { exact: true })
  if (await sel.count()) await selectMatching(sel.first(), new RegExp(`^${state.warehouse.code} `))
}

test.describe.serial('Phase 2: client -> booking -> gate -> inward receipt -> dispatch -> delivery challan', () => {
  test.beforeAll(async () => {
    // Warehouse, zones and slots are infrastructure from Phase 1: created through the API so the test can focus on Phase 2.
    const sb = await adminApi()
    let wh: { id: string; code: string; name: string } | null = null
    for (let i = 0; i < 30 && !wh; i++) {
      const code = `E${Math.floor(Math.random() * 90 + 10)}`   // 3 characters keeps document numbers within 16 characters
      const { data } = await sb.from('warehouses').insert({ code, name: `E2E Hub ${run}`, city: 'Chennai' }).select('id, code, name').single()
      if (data) wh = data
    }
    if (!wh) throw new Error('Could not create an e2e warehouse (code space exhausted: run `npx supabase db reset`)')
    state.warehouse = wh
    const dry = await sb.from('zones').insert({ warehouse_id: wh.id, code: 'Z1', name: 'Dry hall', storage_type: 'DRY' }).select('id').single()
    const froz = await sb.from('zones').insert({ warehouse_id: wh.id, code: 'Z2', name: 'Frozen chamber', storage_type: 'FROZEN', temp_min: -25, temp_max: -15 }).select('id').single()
    const bt = await sb.from('brigade_types').select('id').eq('is_default', true).single()
    for (const [zone, aisles, racks] of [[dry.data!.id, 2, 2], [froz.data!.id, 2, 3]] as const) {
      const { error } = await sb.rpc('create_brigade_slots', { p_zone_id: zone, p_brigade_type_id: bt.data!.id, p_aisles: aisles, p_racks: racks, p_levels: 1, p_slots_per_level: 1, p_aisle_start: 1 })
      if (error) throw error
    }
  })

  test('admin creates a client with contract, companies and a login', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/clients')
    await page.getByRole('button', { name: 'Add client' }).click()
    await page.getByLabel('Company name').fill(CLIENT_NAME)
    await page.getByLabel('GSTIN').fill('33AABCT1332L1ZZ')   // wrong check character
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Enter a valid 15-character GSTIN')).toBeVisible()
    await page.getByLabel('GSTIN').fill(state.gstin)
    await expect(page.getByText(/State code: 33/)).toBeVisible()
    await page.getByLabel('Credit limit (₹)').fill('1,50,000')
    await page.getByRole('button', { name: 'Save' }).click()
    await toast(page, 'Client added')

    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME })
    await expect(row).toBeVisible()
    await expect(row).toContainText('₹1,50,000.00')

    // contract
    await row.getByRole('button', { name: 'Contracts' }).click()
    await page.getByRole('button', { name: 'Add contract' }).click()
    await pickWarehouse(page)
    await page.getByLabel('Committed brigades').fill('5')
    await page.getByRole('button', { name: 'Save' }).click()
    await toast(page, 'Saved')
    await expect(page.getByRole('dialog').getByText('Active')).toBeVisible()
    await page.keyboard.press('Escape')

    // sender and receiver companies
    await row.getByRole('button', { name: 'Sender & receiver companies' }).click()
    for (const [name, kind] of [['Sender Farms', 'Sender'], ['Receiver Mart', 'Receiver']]) {
      await page.getByRole('button', { name: 'Add company' }).click()
      await page.getByLabel('Company name').fill(name)
      await page.getByLabel('Used as').selectOption({ label: kind })
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('dialog').getByRole('cell', { name })).toBeVisible()
    }
    await page.keyboard.press('Escape')

    // login for the client, created by the create-user Edge Function
    await row.getByRole('button', { name: 'Create login' }).click()
    await page.getByLabel('Full name').fill('Client Contact')
    await page.getByLabel('Email').fill(CLIENT_LOGIN.email)
    await page.getByLabel('Temporary password').fill(CLIENT_LOGIN.temp)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await toast(page, 'User account created')
  })

  test('client requests space and the manager approves it', async ({ page }) => {
    await login(page, { email: CLIENT_LOGIN.email, password: CLIENT_LOGIN.temp })
    // first login: forced password change
    await expect(page.getByText('Please set a new password before continuing.')).toBeVisible()
    await page.getByLabel('Current password').fill(CLIENT_LOGIN.temp)
    await page.getByLabel('New password', { exact: true }).fill(CLIENT_LOGIN.next)
    await page.getByLabel('Confirm new password').fill(CLIENT_LOGIN.next)
    await page.getByRole('button', { name: 'Update password' }).click()
    await toast(page, 'Password updated')
    await expect(page.getByRole('heading', { name: CLIENT_NAME })).toBeVisible()

    // a client sees only its own menu
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Stock' })).toBeVisible()
    for (const hidden of ['Clients', 'Audit Log', 'Warehouses', 'Gate Entry', 'Brigade Types']) await expect(nav.getByRole('link', { name: hidden })).toHaveCount(0)

    await page.goto('/bookings')
    await page.getByRole('button', { name: 'Request space' }).click()
    await pickWarehouse(page)
    await page.getByLabel('Storage type').selectOption('FROZEN')
    await page.getByLabel('Set-point (°C)').fill('-18')
    await page.getByLabel('Brigades', { exact: true }).fill('3')
    await page.getByRole('button', { name: 'Check availability' }).click()
    await expect(page.getByTestId('availability')).toContainText('6 free slots')
    await page.getByRole('button', { name: 'Send request' }).click()
    await toast(page, 'Space requested')
    await expect(page.getByRole('row').filter({ hasText: 'Requested' })).toBeVisible()
    await page.goto('/audit')
    await expect(page.getByText('Not allowed')).toBeVisible()
    await logout(page)

    await login(page, ADMIN)
    await page.goto('/bookings')
    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME })
    await row.getByRole('button', { name: 'Approve' }).click()
    await toast(page, 'Approved: 3 slots reserved')
    await expect(row).toContainText('Approved')
  })

  test('staff record an inward lorry with 3 load lines and confirm the receipt', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/gate')
    await page.getByRole('button', { name: 'Inward lorry' }).click()
    await pickWarehouse(page)
    await selectMatching(page.getByLabel('Client', { exact: true }), new RegExp(CLIENT_NAME))
    await page.getByLabel('From company').selectOption({ label: 'Sender Farms' })
    await page.getByLabel('Lorry number').fill('tn 01 e2 1234')
    await page.getByLabel('Driver name').fill('Murugan')
    await page.getByLabel('Seal number (arrival)').fill('S-100')
    await page.getByLabel('E-way bill no.').fill('1234 5678 9012')
    await page.getByLabel('Lorry temperature (°C)').fill('-19')
    await page.getByRole('button', { name: 'Record entry' }).click()
    await toast(page, 'Lorry recorded')
    await expect(page.getByRole('heading', { name: /TN01E21234/ })).toBeVisible()

    // camera / gallery upload to private storage
    await page.getByTestId('photo-input').setInputFiles({ name: 'lorry.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.locator('img').first()).toBeVisible()

    const lines = [
      { item: 'Frozen peas', sku: SKU, batch: 'B-LATE', expiry: '2027-06-30', qty: '100', unit: 'BOX', packages: '100', kg: '1200', type: 'FROZEN', temp: '-18' },
      { item: 'Rice bags', sku: 'DRY-RICE', batch: 'R-1', expiry: '', qty: '50', unit: 'BAG', packages: '50', kg: '400', type: 'DRY', temp: '' },
      { item: 'Biscuits', sku: 'DRY-BIS', batch: 'BIS-1', expiry: '2027-03-31', qty: '20', unit: 'BOX', packages: '20', kg: '200', type: 'DRY', temp: '' },
    ]
    for (const l of lines) {
      await page.getByRole('button', { name: 'Add line' }).click()
      await page.getByLabel('Item', { exact: true }).fill(l.item)
      await page.getByLabel('SKU').fill(l.sku)
      await page.getByLabel('Batch').fill(l.batch)
      if (l.expiry) await page.getByLabel('Expiry').fill(l.expiry)
      await page.getByLabel('Declared quantity').fill(l.qty)
      await page.getByLabel('Unit', { exact: true }).fill(l.unit)
      await page.getByLabel('Packages').fill(l.packages)
      await page.getByLabel('Weight (kg)').fill(l.kg)
      await page.getByLabel('Storage type').selectOption(l.type)
      if (l.temp) await page.getByLabel('Required temperature (°C)').fill(l.temp)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('row').filter({ hasText: l.item })).toBeVisible()
    }
    await expect(page.getByText('3 lines · 170 packages · 1.8 t')).toBeVisible()

    await page.getByRole('link', { name: 'Receive goods' }).click()
    // line 3: 15 accepted, 5 damaged
    await page.getByLabel('Accepted').nth(2).fill('15')
    await page.getByLabel('Damaged', { exact: true }).nth(2).fill('5')
    await expect(page.getByRole('button', { name: 'Confirm receipt' })).toBeDisabled()   // nothing placed yet
    await page.getByRole('button', { name: 'Suggest slots' }).click()
    await toast(page, /placements suggested/)
    await expect(page.getByText('Placed in full')).toHaveCount(3)
    await page.getByLabel('Workers').fill('3')
    await page.getByLabel('Hours').fill('2')
    await page.getByRole('button', { name: 'Confirm receipt' }).click()
    await toast(page, 'Receipt confirmed')
    await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}/)
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText(new RegExp(`^GR/${state.warehouse.code}/\\d{4}/0001$`))
    const receiptNo = (await heading.textContent())!.trim()
    expect(receiptNo.length).toBeLessThanOrEqual(16)
    state.receiptNo = receiptNo
    await expect(page.getByText('5', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('crushed')).toHaveCount(0)

    // slots became occupied (and the reserved ones were used first)
    const sb = await adminApi()
    const occupied = await sb.from('brigade_slots').select('id', { count: 'exact', head: true }).eq('warehouse_id', state.warehouse.id).eq('status', 'OCCUPIED')
    expect(occupied.count).toBeGreaterThanOrEqual(4)
    const reservedLeft = await sb.from('brigade_slots').select('id', { count: 'exact', head: true }).eq('warehouse_id', state.warehouse.id).eq('status', 'RESERVED')
    expect(reservedLeft.count).toBe(1)   // 3 reserved, the 1200 kg of peas took 2

    // the receipt PDF downloads
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()])
    expect(download.suggestedFilename()).toBe(`${receiptNo.replace(/\//g, '-')}.pdf`)
    const bytes = fs.readFileSync((await download.path())!)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(2000)
  })

  test('client raises a dispatch request for part of the stock', async ({ page }) => {
    await login(page, { email: CLIENT_LOGIN.email, password: CLIENT_LOGIN.next })
    await page.goto('/stock')
    await expect(page.getByRole('row').filter({ hasText: 'Frozen peas' }).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Frozen peas' })).toHaveCount(2)    // split over two brigades (1200 kg > 1000 kg)
    await expect(page.getByLabel('Client', { exact: true })).toHaveCount(0)          // no client filter: only its own stock

    await page.goto('/dispatch')
    await page.getByRole('button', { name: 'New dispatch request' }).click()
    await pickWarehouse(page)
    await page.getByLabel('To company').selectOption({ label: 'Receiver Mart' })
    await selectMatching(page.getByLabel('Item 1'), /Frozen peas/)
    await page.getByLabel('Quantity 1').fill('40')
    await page.getByRole('button', { name: 'Send request' }).click()
    await toast(page, 'Dispatch requested')
    await expect(page.getByRole('row').filter({ hasText: /DR\//}).filter({ hasText: 'Requested' })).toBeVisible()
    await logout(page)
  })

  test('manager approves, staff pick by scanning (wrong batch refused) and confirm the challan with a signature', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/dispatch')
    const row = page.getByRole('row').filter({ hasText: CLIENT_NAME })
    await row.getByRole('button', { name: 'Approve' }).click()
    await toast(page, /Approved: \d+ picks created/)
    await row.getByRole('link', { name: 'Pick & dispatch' }).click()

    const scan = page.getByLabel('Scan or type a code')
    await scan.fill('WRONG-BATCH')
    await scan.press('Enter')
    await expect(page.getByTestId('scan-result')).toContainText(/Wrong batch/)
    await expect(page.getByRole('heading', { name: 'Delivery challan' })).toHaveCount(0)   // still not all picked

    // the 40 boxes may sit in more than one slot: every pick must be scanned (batch label shown here)
    const picks = await page.locator('[data-testid^="pick-"]').count()
    expect(picks).toBeGreaterThanOrEqual(1)
    for (let i = 0; i < picks; i++) {
      await expect(page.getByRole('heading', { name: 'Delivery challan' })).toHaveCount(0)   // not before the last pick
      await scan.fill('b-late')
      await scan.press('Enter')
      await expect(page.getByTestId('scan-result')).toContainText(/Picked from/)
      await expect(page.getByLabel('Picked')).toHaveCount(i + 1)
    }
    await expect(page.getByRole('heading', { name: 'Delivery challan' })).toBeVisible()

    await page.getByLabel('Lorry number').fill('TN 09 E2 9999')
    await page.getByLabel('Driver name').fill('Kannan')
    await page.getByLabel('Dispatch temperature (°C)').fill('-18')
    await page.getByLabel('Seal number').fill('SEAL-77')
    await page.getByLabel('Receiver name').fill('Ravi')
    const canvas = page.getByTestId('signature-canvas')
    await canvas.scrollIntoViewIfNeeded()
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + 30, box.y + 80)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 30, { steps: 6 })
    await page.mouse.move(box.x + 200, box.y + 100, { steps: 6 })
    await page.mouse.up()
    await expect(page.getByText('Signature captured')).toBeVisible()
    await page.getByLabel('Workers').fill('2')
    await page.getByLabel('Hours').fill('1')
    await page.getByRole('button', { name: 'Confirm challan' }).click()
    await toast(page, 'Challan confirmed')
    await expect(page).toHaveURL(/\/challans/)

    const crow = page.getByRole('row').filter({ hasText: CLIENT_NAME })
    await expect(crow).toContainText('Signed')
    state.challanNo = (await crow.locator('td').first().textContent())!.trim()
    expect(state.challanNo).toMatch(new RegExp(`^DC/${state.warehouse.code}/\\d{4}/0001$`))
    await crow.getByRole('button', { name: 'View' }).click()
    await expect(page.getByRole('dialog')).toContainText('SEAL-77')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()])
    const bytes = fs.readFileSync((await download.path())!)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(3000)   // includes the signature image

    // stock and slots updated: 60 boxes of peas left, no stock row lost
    const sb = await adminApi()
    const { data: peas } = await sb.from('stock_items').select('quantity').eq('sku', SKU).gt('quantity', 0)
    expect(peas!.reduce((n, r) => n + Number(r.quantity), 0)).toBe(60)
    // one OUT movement per pick (the peas sit in two slots); together they are the 40 boxes dispatched
    const { data: out } = await sb.from('stock_movements').select('qty_delta').eq('movement_type', 'OUT').eq('warehouse_id', state.warehouse.id)
    expect(out!.length).toBeGreaterThanOrEqual(1)
    expect(Math.round(out!.reduce((n, m) => n + Number(m.qty_delta), 0) * 1000) / 1000).toBe(-40)
  })

  test('the client sees its own documents (and only those)', async ({ page }) => {
    await login(page, { email: CLIENT_LOGIN.email, password: CLIENT_LOGIN.next })
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Delivery Challans' })).toBeVisible()
    await page.goto('/challans')
    await expect(page.getByRole('row').filter({ hasText: 'DC/' })).toHaveCount(1)
    await page.goto('/receipts')
    await expect(page.getByRole('row').filter({ hasText: state.receiptNo! })).toBeVisible()
    await page.goto('/dispatch')
    await expect(page.getByRole('row').filter({ hasText: /DR\//}).filter({ hasText: 'Dispatched' })).toBeVisible()

    // the API enforces the same: another client's data is invisible to this login
    const sb = createClient(API, ANON, { auth: { persistSession: false } })
    await sb.auth.signInWithPassword({ email: CLIENT_LOGIN.email, password: CLIENT_LOGIN.next })
    const clients = await sb.from('clients').select('id')
    expect(clients.data).toHaveLength(1)
    const everything = await sb.from('stock_items').select('client_id')
    expect(new Set((everything.data ?? []).map((r) => r.client_id)).size).toBe(1)
    const audit = await sb.from('audit_logs').select('id')
    expect(audit.data).toHaveLength(0)
  })
})
