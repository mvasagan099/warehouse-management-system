// Edge Function: razorpay-link. Creates a Razorpay payment link for what an invoice still owes. Behind the `razorpay` setting flag.
// RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are Edge Function secrets; the secret never reaches the browser.
import { razorpayBasicAuth, razorpayLinkBody } from '../_shared/billing-rules.ts'
import { corsHeaders, json, requireAdmin, serviceClient, setting } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const who = await requireAdmin(req)
  if (who instanceof Response) return who

  let body: { invoice_id?: string }
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  if (!body.invoice_id) return json(400, { error: 'invoice_id is required' })

  const admin = serviceClient()
  if (!(await setting(admin, 'razorpay')).enabled) return json(409, { error: 'Online payment is switched off (Billing settings)' })
  const keyId = Deno.env.get('RAZORPAY_KEY_ID'); const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!keyId || !keySecret) return json(500, { error: 'Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET secrets' })

  const { data: inv } = await admin.from('invoices').select('*').eq('id', body.invoice_id).maybeSingle()
  if (!inv || inv.status === 'DRAFT' || inv.status === 'CANCELLED') return json(404, { error: 'Only issued invoices can be paid online' })
  const due = inv.grand_total_paise - inv.paid_paise - inv.credit_paise
  if (due <= 0) return json(409, { error: 'Nothing is outstanding on this invoice' })
  const { data: client } = await admin.from('clients').select('company_name, email, phone').eq('id', inv.client_id).maybeSingle()

  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: razorpayBasicAuth(keyId, keySecret), 'Content-Type': 'application/json' },
    body: JSON.stringify(razorpayLinkBody({ amountPaise: due, invoiceNo: inv.invoice_no, clientName: client?.company_name ?? 'Customer',
      email: client?.email, phone: client?.phone, invoiceId: inv.id, clientId: inv.client_id, warehouseId: inv.warehouse_id })),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || !out.short_url) return json(502, { error: `Razorpay refused the request (${res.status})` })
  return json(200, { short_url: out.short_url, amount_paise: due })
})
