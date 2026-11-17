// Edge Function: send-invoice. Emails an issued invoice (PDF attached) through Resend.
// The Resend key lives in Edge Function secrets (RESEND_API_KEY), never in the browser. Behind the `email` setting flag.
// The browser generates the PDF, uploads it to the private `invoices` bucket at <warehouse_id>/<invoice_id>.pdf, then calls this function.
import { buildInvoiceEmail, isEmail, resendPayload } from '../_shared/billing-rules.ts'
import { base64FromBytes, corsHeaders, json, requireAdmin, serviceClient, setting } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const who = await requireAdmin(req)
  if (who instanceof Response) return who

  let body: { invoice_id?: string; to?: string; pay_link?: string }
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  if (!body.invoice_id) return json(400, { error: 'invoice_id is required' })

  const admin = serviceClient()
  const email = await setting(admin, 'email')
  if (!email.enabled) return json(409, { error: 'Invoice email is switched off (Billing settings)' })
  const key = Deno.env.get('RESEND_API_KEY')
  const from = (email.from as string) || Deno.env.get('RESEND_FROM') || ''
  if (!key || !from) return json(500, { error: 'Email is not configured: set the RESEND_API_KEY secret and a From address' })

  const { data: inv } = await admin.from('invoices').select('*').eq('id', body.invoice_id).maybeSingle()
  if (!inv || inv.status === 'DRAFT' || inv.status === 'CANCELLED') return json(404, { error: 'Only issued invoices can be emailed' })
  const { data: client } = await admin.from('clients').select('company_name, email').eq('id', inv.client_id).maybeSingle()
  const to = (body.to ?? client?.email ?? '').trim()
  if (!isEmail(to)) return json(422, { error: 'The client has no valid email address' })

  const path = `${inv.warehouse_id}/${inv.id}.pdf`
  const file = await admin.storage.from('invoices').download(path)
  if (file.error || !file.data) return json(409, { error: 'The invoice PDF has not been uploaded yet' })
  const pdf = base64FromBytes(new Uint8Array(await file.data.arrayBuffer()))

  const supplier = ((inv.supplier_snapshot ?? {}) as Record<string, string>)
  const terms = await setting(admin, 'invoice_terms')
  const mail = buildInvoiceEmail({
    supplierName: supplier.legal_name || supplier.name || 'Warehouse',
    clientName: client?.company_name ?? 'Customer',
    invoiceNo: inv.invoice_no, invoiceDate: inv.invoice_date, dueDate: inv.due_date,
    grandTotalPaise: inv.grand_total_paise, outstandingPaise: inv.grand_total_paise - inv.paid_paise - inv.credit_paise,
    payLink: body.pay_link ?? null, terms: typeof terms === 'string' ? terms : null,
  })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(resendPayload({ from, to, ...mail, pdfBase64: pdf, pdfName: `${String(inv.invoice_no).replaceAll('/', '-')}.pdf` })),
  })
  if (!res.ok) return json(502, { error: `Email provider refused the message (${res.status})` })
  await admin.from('invoices').update({ emailed_at: new Date().toISOString(), pdf_path: path }).eq('id', inv.id)
  return json(200, { sent_to: to })
})
