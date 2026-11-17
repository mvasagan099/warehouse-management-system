import { createClient } from '@supabase/supabase-js'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { gstinCheckChar } from '../src/lib/gstin'

// Phase 3 flow against the LOCAL stack: set rates -> receive stock -> advance days -> generate invoice -> preview -> issue ->
// record payment -> client downloads the PDF (and an accountant can read but not change anything).
function env(): { url: string; key: string } {
  const text = fs.readFileSync('.env.local', 'utf8')
  const get = (k: string) => new RegExp(`^${k}=(.*)$`, 'm').exec(text)?.[1].trim() ?? ''
  const url = get('VITE_SUPABASE_URL')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error('The e2e flow only runs against the local Supabase stack')
  return { url, key: get('VITE_SUPABASE_ANON_KEY') }
}
const { url: API, key: ANON } = env()
const ADMIN = { email: 'admin@warehouse.local', password: 'Admin@12345' }   // seeded LOCAL admin only

const run = Date.now().toString(36)
const CLIENT_NAME = `Billing Foods ${run}`
const CLIENT = { email: `bill-client-${run}@e2e.test`, temp: 'Temp-Pass-1234', next: 'E2e-Client-5678' }
const ACCOUNTANT = { email: `accountant-${run}@e2e.test`, temp: 'Acct-Temp-12345', password: 'Acct-Pass-67890' }

const istDate = (offsetDays: number) => new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)

function gstin(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const r = parseInt(run, 36) % 2 ** 31
  const pick = (shift: number) => letters[Math.floor(r / 2 ** shift) % 24]
  const pan = `${pick(1)}${pick(4)}${pick(7)}CT${String(r % 10000).padStart(4, '0')}${pick(10)}`
  const first14 = `33${pan}1Z`
  return first14 + gstinCheckChar(first14)
}

const state = { wh: { id: '', code: '' }, clientId: '', invoiceNo: '' }

/** Run SQL as the database owner in the local container: used only to move time forward ("advance days"). */
function sql(statement: string) {
  const db = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' }).split('\n').find((n) => n.startsWith('supabase_db_'))
  if (!db) throw new Error('Local Supabase database container not found')
  execFileSync('docker', ['exec', '-i', db, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qtA', '-c', statement], { encoding: 'utf8' })
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
async function selectMatching(select: Locator, re: RegExp) {
  const value = await select.locator('option').evaluateAll((opts, src) => {
    const r = new RegExp(src)
    return (opts as HTMLOptionElement[]).find((o) => r.test(o.textContent ?? ''))?.value ?? null
  }, re.source)
  if (value === null) throw new Error(`No option matching ${re}`)
  await select.selectOption(value)
}

test.describe.serial('Phase 3: rates -> stock -> invoice -> issue -> payment -> client PDF', () => {
  test.beforeAll(async () => {
    const sb = await adminApi()
    let wh: { id: string; code: string } | null = null
    for (let i = 0; i < 30 && !wh; i++) {
      const code = `B${Math.floor(Math.random() * 90 + 10)}`
      const { data } = await sb.from('warehouses').insert({ code, name: `Billing Hub ${run}`, city: 'Chennai' }).select('id, code').single()
      if (data) wh = data
    }
    if (!wh) throw new Error('Could not create a warehouse (run `npx supabase db reset`)')
    state.wh = wh
    const froz = await sb.from('zones').insert({ warehouse_id: wh.id, code: 'Z2', name: 'Frozen chamber', storage_type: 'FROZEN', temp_min: -25, temp_max: -15 }).select('id').single()
    const bt = await sb.from('brigade_types').select('id').eq('is_default', true).single()
    const slots = await sb.rpc('create_brigade_slots', { p_zone_id: froz.data!.id, p_brigade_type_id: bt.data!.id, p_aisles: 1, p_racks: 4, p_levels: 1, p_slots_per_level: 1, p_aisle_start: 1 })
    if (slots.error) throw slots.error
    const client = await sb.from('clients').insert({ company_name: CLIENT_NAME, gstin: gstin(), credit_limit_paise: 10_000_000 }).select('id').single()
    if (client.error) throw client.error
    state.clientId = client.data.id
    const contract = await sb.from('contracts').insert({ client_id: state.clientId, warehouse_id: wh.id, start_date: istDate(-60), status: 'ACTIVE' })
    if (contract.error) throw contract.error
    const company = await sb.from('company_master').insert({ client_id: state.clientId, kind: 'SENDER', name: 'Sender Farms' })
    if (company.error) throw company.error
    // logins: a client and an accountant (through the create-user Edge Function, as the app does)
    for (const body of [
      { email: CLIENT.email, password: CLIENT.temp, full_name: 'Billing Client', role: 'CLIENT', warehouse_ids: [], client_id: state.clientId },
      { email: ACCOUNTANT.email, password: ACCOUNTANT.temp, full_name: 'The Accountant', role: 'ACCOUNTANT', warehouse_ids: [] },
    ]) {
      const { error } = await sb.functions.invoke('create-user', { body })
      if (error) throw new Error(`create-user failed: ${JSON.stringify(await (error as { context?: Response }).context?.json?.().catch(() => error))}`)
    }
  })

  test('admin sets a client rate card (rent and labour) and checks it with the rate tester', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/rates')
    await page.getByRole('button', { name: 'New rate card' }).click()
    await page.getByLabel('Name', { exact: true }).fill(`Card ${run}`)
    await selectMatching(page.getByLabel('Client', { exact: true }), new RegExp(CLIENT_NAME))
    await page.getByLabel('Valid from').fill(istDate(-30))
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
    await toast(page, 'Rate card created')

    await page.getByRole('row').filter({ hasText: `Card ${run}` }).getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Add rent rate' }).first().click()
    await page.getByLabel('Storage type').selectOption('FROZEN')
    await page.getByLabel('Rate (₹)').fill('100')
    await page.getByLabel('Valid from').fill(istDate(-30))
    await page.getByRole('button', { name: 'Save' }).click()
    await toast(page, 'Rate saved')
    await page.getByRole('button', { name: 'Add labour rate' }).click()
    await page.getByLabel('Activity').selectOption('UNLOADING')
    await page.getByLabel('Basis').selectOption('PER_PACKAGE')
    await page.getByLabel('Rate (₹)').fill('5')
    await page.getByLabel('Valid from').fill(istDate(-30))
    await page.getByRole('button', { name: 'Save' }).click()
    await toast(page, 'Rate saved')
    await expect(page.getByRole('dialog').first()).toContainText('₹100.00')
    await page.keyboard.press('Escape')

    // rate tester: which rate applies and why
    await page.getByRole('tab', { name: 'Rate tester' }).click()
    await selectMatching(page.getByLabel('Client', { exact: true }), new RegExp(CLIENT_NAME))
    await selectMatching(page.getByLabel('Warehouse', { exact: true }), new RegExp(`^${state.wh.code} `))
    await expect(page.getByTestId('rate-test-result')).toContainText('This rate applies')
    await expect(page.getByTestId('rate-test-result')).toContainText(`Client rate card "Card ${run}"`)
    await expect(page.getByTestId('rate-test-result')).toContainText('₹100.00')
  })

  test('staff receive 50 boxes of frozen peas', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/gate')
    await page.getByRole('button', { name: 'Inward lorry' }).click()
    const whSelect = page.getByLabel('Warehouse', { exact: true })
    if (await whSelect.count()) await selectMatching(whSelect.first(), new RegExp(`^${state.wh.code} `))
    await selectMatching(page.getByLabel('Client', { exact: true }), new RegExp(CLIENT_NAME))
    await page.getByLabel('From company').selectOption({ label: 'Sender Farms' })
    await page.getByLabel('Lorry number').fill('tn 01 b3 4321')
    await page.getByLabel('Driver name').fill('Selvam')
    await page.getByRole('button', { name: 'Record entry' }).click()
    await toast(page, 'Lorry recorded')
    await page.getByRole('button', { name: 'Add line' }).click()
    await page.getByLabel('Item', { exact: true }).fill('Frozen peas')
    await page.getByLabel('Declared quantity').fill('50')
    await page.getByLabel('Unit', { exact: true }).fill('BOX')
    await page.getByLabel('Packages').fill('50')
    await page.getByLabel('Weight (kg)').fill('400')
    await page.getByLabel('Storage type').selectOption('FROZEN')
    await page.getByLabel('Required temperature (°C)').fill('-18')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('row').filter({ hasText: 'Frozen peas' })).toBeVisible()
    await page.getByRole('link', { name: 'Receive goods' }).click()
    await page.getByRole('button', { name: 'Suggest slots' }).click()
    await toast(page, /placements suggested/)
    await page.getByLabel('Workers').fill('3')
    await page.getByLabel('Hours').fill('2')
    await page.getByRole('button', { name: 'Confirm receipt' }).click()
    await toast(page, 'Receipt confirmed')
  })

  test('time moves on: the stock has been held for 5 days and the daily snapshots are filled in', async ({ page }) => {
    // advance days: the allocation started 5 days ago and the receipt is 3 days old
    sql(`set session_replication_role = replica;
      update public.slot_allocations set start_date = public.today_ist() - 5 where client_id = '${state.clientId}';
      update public.inward_receipts set received_at = received_at - interval '3 days' where client_id = '${state.clientId}';`)
    await login(page, ADMIN)
    await page.goto('/billing-settings')
    // days stored earlier (by other runs) are not touched by "fill missing days": recompute the range after back-dating the allocation
    await page.getByLabel('From', { exact: true }).fill(istDate(-5))
    await page.getByLabel('To', { exact: true }).fill(istDate(-1))
    await page.getByRole('button', { name: 'Recompute these days' }).click()
    await toast(page, /day\(s\) added/)
    const sb = await adminApi()
    const { data } = await sb.from('daily_occupancy').select('occ_date, brigades').eq('client_id', state.clientId).order('occ_date')
    expect(data!.length).toBe(5)
    expect(data!.every((r) => r.brigades === 1)).toBe(true)
  })

  test('admin generates the invoice, previews every line with its rate source, issues it and records a payment', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/invoices')
    await page.getByRole('button', { name: 'Generate invoice' }).click()
    await selectMatching(page.getByLabel('Client', { exact: true }), new RegExp(CLIENT_NAME))
    await selectMatching(page.getByLabel('Warehouse', { exact: true }), new RegExp(`^${state.wh.code} `))
    await page.getByLabel('From', { exact: true }).fill(istDate(-5))
    await page.getByLabel('To', { exact: true }).fill(istDate(-1))
    await page.getByRole('button', { name: 'Create draft' }).click()
    await toast(page, 'Draft invoice created')

    // preview: A rent 5 days x 100 = 500.00, B labour 50 packages x 5 = 250.00; 18 % GST -> CGST + SGST; total 885.00
    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toContainText('Draft')
    await expect(dialog).toContainText('A. Rent (storage)')
    await expect(dialog).toContainText('B. Labour (handling)')
    await expect(dialog.getByTestId('rate-source').first()).toContainText(`Client rate card "Card ${run}"`)
    await expect(dialog).toContainText('TN01B34321')           // the lorry on the labour line
    await expect(dialog).toContainText('Subtotal A: ₹500.00')
    await expect(dialog).toContainText('Subtotal B: ₹250.00')
    await expect(dialog.getByTestId('grand-total')).toContainText('₹885.00')
    await expect(dialog).toContainText('996721')               // SAC for refrigerated storage (suggested default)

    // a draft can be fixed with a reason: nothing is final yet. Then restore it by fixing back.
    await page.getByRole('button', { name: 'Fix line' }).first().click()
    await page.getByLabel('Amount (₹)').fill('450')
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()   // a reason is required
    await page.getByLabel('Reason (required)').fill('Agreed discount for the first week')
    await page.getByRole('button', { name: 'Save' }).click()
    await toast(page, 'Line updated')
    await expect(dialog).toContainText('Fixed (was ₹500.00)')
    await expect(dialog.getByTestId('grand-total')).toContainText('₹826.00')
    await page.getByRole('button', { name: 'Fix line' }).first().click()
    await page.getByLabel('Amount (₹)').fill('500')
    await page.getByLabel('Reason (required)').fill('Reverted')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(dialog.getByTestId('grand-total')).toContainText('₹885.00')

    // issue: numbered, locked
    await page.getByRole('button', { name: 'Issue invoice' }).click()
    await page.getByRole('dialog').filter({ hasText: 'locks it for ever' }).last().getByRole('button', { name: 'Issue invoice' }).click()
    await toast(page, /Invoice IN\/.* issued/)
    const heading = page.getByRole('heading', { name: new RegExp(`^IN/${state.wh.code}/\\d{4}/0001$`) })
    await expect(heading).toBeVisible()
    state.invoiceNo = (await heading.textContent())!.trim()
    expect(state.invoiceNo.length).toBeLessThanOrEqual(16)
    await expect(dialog).toContainText('Issued')
    await expect(page.getByRole('button', { name: 'Fix line' })).toHaveCount(0)      // no edit once issued
    await expect(page.getByRole('button', { name: 'Issue invoice' })).toHaveCount(0)

    // the API refuses to change or delete an issued invoice, even for the administrator
    const sb = await adminApi()
    const upd = await sb.from('invoices').update({ grand_total_paise: 1 }).eq('invoice_no', state.invoiceNo)
    expect(upd.error).not.toBeNull()
    const del = await sb.from('invoices').delete().eq('invoice_no', state.invoiceNo)
    expect(del.error).not.toBeNull()

    // partial payment: 300.00 of 885.00
    await page.getByRole('dialog').getByRole('button', { name: 'Record payment' }).click()
    await page.getByLabel('Amount (₹)').fill('300')
    await page.getByLabel('Reference (UTR / cheque no.)').fill('UTR-E2E-1')
    await page.getByRole('dialog').filter({ hasText: 'Payment' }).last().getByRole('button', { name: 'Save' }).click()
    await toast(page, 'Payment recorded')
    await expect(dialog).toContainText('Partly paid')
    await expect(dialog).toContainText('₹585.00')
  })

  test('the client sees only the issued invoice, its ledger and downloads the PDF', async ({ page }) => {
    await login(page, { email: CLIENT.email, password: CLIENT.temp })
    await page.getByLabel('Current password').fill(CLIENT.temp)
    await page.getByLabel('New password', { exact: true }).fill(CLIENT.next)
    await page.getByLabel('Confirm new password').fill(CLIENT.next)
    await page.getByRole('button', { name: 'Update password' }).click()
    await toast(page, 'Password updated')
    await expect(page.getByText('₹585.00').first()).toBeVisible()             // amount due on the home tile

    await page.goto('/invoices')
    await expect(page.getByRole('row').filter({ hasText: state.invoiceNo })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Draft' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Generate invoice' })).toHaveCount(0)
    await page.getByRole('row').filter({ hasText: state.invoiceNo }).getByRole('button', { name: 'View' }).click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()])
    expect(download.suggestedFilename()).toBe(`${state.invoiceNo.replace(/\//g, '-')}.pdf`)
    const bytes = fs.readFileSync((await download.path())!)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(3000)
    await page.keyboard.press('Escape')

    await page.goto('/ledger')
    await expect(page.getByRole('cell', { name: state.invoiceNo })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'UTR-E2E-1' })).toBeVisible()
    await expect(page.getByText('My rates')).toBeVisible()

    // client cannot reach the admin pages, and the API shows only its own data
    await page.goto('/rates')
    await expect(page.getByText('Not allowed')).toBeVisible()
    const sb = createClient(API, ANON, { auth: { persistSession: false } })
    await sb.auth.signInWithPassword({ email: CLIENT.email, password: CLIENT.next })
    expect((await sb.from('rate_cards').select('id')).data).toHaveLength(0)
    const inv = await sb.from('invoices').select('client_id, status')
    expect(inv.data!.length).toBe(1)
    expect(inv.data![0].client_id).toBe(state.clientId)
  })

  test('an accountant reads and exports everything but cannot change anything', async ({ page }) => {
    await login(page, { email: ACCOUNTANT.email, password: ACCOUNTANT.temp })
    await page.getByLabel('Current password').fill(ACCOUNTANT.temp)
    await page.getByLabel('New password', { exact: true }).fill(ACCOUNTANT.password)
    await page.getByLabel('Confirm new password').fill(ACCOUNTANT.password)
    await page.getByRole('button', { name: 'Update password' }).click()
    await toast(page, 'Password updated')
    await page.goto('/')
    await expect(page).toHaveURL(/\/invoices/)                                 // the accountant lands on billing
    await expect(page.getByRole('row').filter({ hasText: state.invoiceNo })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Generate invoice' })).toHaveCount(0)
    await page.goto('/rates')
    await expect(page.getByRole('button', { name: 'New rate card' })).toHaveCount(0)
    await page.goto('/billing-reports')
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'GSTR-1 sales register (CSV)' }).click()])
    const text = fs.readFileSync((await csv.path())!, 'utf8')
    expect(text).toContain(state.invoiceNo)
    expect(text).toContain('B2B')
    const [xml] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tally export (XML)' }).click()])
    expect(fs.readFileSync((await xml.path())!, 'utf8')).toContain('<ENVELOPE>')
    await page.goto('/ledger')
    await expect(page.getByTestId('ageing')).toContainText(CLIENT_NAME)
    await logout(page)

    const sb = createClient(API, ANON, { auth: { persistSession: false } })
    await sb.auth.signInWithPassword({ email: ACCOUNTANT.email, password: ACCOUNTANT.password })
    expect((await sb.from('rate_cards').insert({ name: 'x', scope: 'GLOBAL', valid_from: istDate(0) })).error).not.toBeNull()
    expect((await sb.rpc('issue_invoice', { p_invoice_id: '00000000-0000-0000-0000-000000000000' })).error).not.toBeNull()
  })
})
