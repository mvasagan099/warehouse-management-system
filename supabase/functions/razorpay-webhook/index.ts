// Edge Function: razorpay-webhook. Razorpay calls it when a payment link is paid. Deployed WITHOUT JWT verification (see supabase/config.toml):
// the request is authenticated by the HMAC signature of the raw body using RAZORPAY_WEBHOOK_SECRET. Retries are harmless: the Razorpay
// payment id is stored as `external_ref` (unique), so record_payment returns the existing payment instead of recording twice.
import { parseRazorpayEvent, verifyRazorpaySignature } from '../_shared/billing-rules.ts'
import { json, serviceClient, setting } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? ''
  const raw = await req.text()
  if (!(await verifyRazorpaySignature(raw, req.headers.get('x-razorpay-signature'), secret))) return json(401, { error: 'Bad signature' })

  const admin = serviceClient()
  if (!(await setting(admin, 'razorpay')).enabled) return json(200, { ignored: 'online payment is switched off' })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return json(400, { error: 'Invalid JSON' }) }
  const ev = parseRazorpayEvent(body)
  if (ev.kind === 'ignored') return json(200, { ignored: ev.reason })

  const { data, error } = await admin.rpc('record_payment', {
    p_client_id: ev.clientId, p_warehouse_id: ev.warehouseId, p_amount_paise: ev.amountPaise, p_method: 'ONLINE', p_reference: ev.reference,
    p_paid_on: new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10), p_invoice_id: ev.invoiceId, p_external_ref: ev.externalRef,
    p_notes: 'Razorpay payment link',
  })
  if (error) return json(500, { error: error.message })   // Razorpay retries on a non-2xx answer
  return json(200, { payment_id: data })
})
