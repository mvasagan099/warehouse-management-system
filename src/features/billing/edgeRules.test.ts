// Tests the pure rules behind the send-invoice, Razorpay and reminder Edge Functions.
import { describe, expect, it } from 'vitest'
import {
  buildInvoiceEmail, buildReminderEmail, daysBetween, hmacSha256Hex, parseRazorpayEvent, razorpayBasicAuth, razorpayLinkBody,
  resendPayload, toRupees, verifyRazorpaySignature,
} from '../../../supabase/functions/_shared/billing-rules.ts'

const mail = { supplierName: 'Cold Co <Ltd>', clientName: 'Acme & Sons', invoiceNo: 'IN/W1/2627/0001', invoiceDate: '2026-11-17', dueDate: '2026-12-02',
  grandTotalPaise: 12_500_000, outstandingPaise: 5_000_050 }

describe('billing emails', () => {
  it('formats amounts in Indian grouping', () => {
    expect(toRupees(12_500_000)).toBe('1,25,000.00')
    expect(toRupees(5)).toBe('0.05')
  })
  it('builds the invoice email and escapes HTML', () => {
    const e = buildInvoiceEmail({ ...mail, payLink: 'https://rzp.io/l/x' })
    expect(e.subject).toBe('Invoice IN/W1/2627/0001 from Cold Co <Ltd>')
    expect(e.text).toContain('Amount due: Rs. 50,000.50 by 2026-12-02')
    expect(e.text).toContain('Pay online: https://rzp.io/l/x')
    expect(e.html).toContain('Acme &amp; Sons')
    expect(e.html).not.toContain('<Ltd>')
  })
  it('builds the reminder email', () => {
    expect(buildReminderEmail({ ...mail, daysOverdue: 1 }).subject).toBe('Payment reminder: invoice IN/W1/2627/0001 is 1 day overdue')
    expect(buildReminderEmail({ ...mail, daysOverdue: 7 }).subject).toContain('7 days overdue')
  })
  it('attaches the PDF to the Resend request only when given', () => {
    const base = { from: 'a@b.in', to: 'c@d.in', subject: 's', html: 'h', text: 't' }
    expect(resendPayload(base)).not.toHaveProperty('attachments')
    expect(resendPayload({ ...base, pdfBase64: 'QUJD', pdfName: 'x.pdf' }).attachments).toEqual([{ filename: 'x.pdf', content: 'QUJD' }])
  })
  it('counts days between ISO dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7)
    expect(daysBetween('2026-12-02', '2026-12-02')).toBe(0)
  })
})

describe('Razorpay', () => {
  const secret = 'whsec_test'
  const body = JSON.stringify({ event: 'payment_link.paid' })
  it('verifies the webhook signature (HMAC-SHA256 of the raw body)', async () => {
    const sig = await hmacSha256Hex(secret, body)
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
    expect(await verifyRazorpaySignature(body, sig, secret)).toBe(true)
  })
  it('rejects a wrong, missing, tampered or wrong-secret signature', async () => {
    const sig = await hmacSha256Hex(secret, body)
    expect(await verifyRazorpaySignature(body, sig.replace(/.$/, sig.endsWith('0') ? '1' : '0'), secret)).toBe(false)
    expect(await verifyRazorpaySignature(body + ' ', sig, secret)).toBe(false)
    expect(await verifyRazorpaySignature(body, sig, 'other')).toBe(false)
    expect(await verifyRazorpaySignature(body, null, secret)).toBe(false)
    expect(await verifyRazorpaySignature(body, 'abc', secret)).toBe(false)
    expect(await verifyRazorpaySignature(body, sig, '')).toBe(false)
  })
  const event = (over: Record<string, unknown> = {}) => ({
    event: 'payment_link.paid',
    payload: {
      payment: { entity: { id: 'pay_123', amount: 118000, status: 'captured', ...over } },
      payment_link: { entity: { notes: { invoice_id: 'inv-1', client_id: 'cl-1', warehouse_id: 'wh-1' } } },
    },
  })
  it('reads a paid event into a payment to record (idempotent on the Razorpay payment id)', () => {
    expect(parseRazorpayEvent(event())).toEqual({ kind: 'paid', externalRef: 'pay_123', amountPaise: 118000, invoiceId: 'inv-1', clientId: 'cl-1',
      warehouseId: 'wh-1', reference: 'pay_123' })
  })
  it('ignores events it should not record', () => {
    expect(parseRazorpayEvent({ event: 'payment.failed' }).kind).toBe('ignored')
    expect(parseRazorpayEvent(event({ status: 'failed' })).kind).toBe('ignored')
    expect(parseRazorpayEvent(event({ amount: 0 })).kind).toBe('ignored')
    expect(parseRazorpayEvent(event({ amount: 10.5 })).kind).toBe('ignored')
    expect(parseRazorpayEvent({ event: 'payment_link.paid', payload: { payment: { entity: { id: 'p', amount: 100 } } } }).kind).toBe('ignored')
    expect(parseRazorpayEvent(null).kind).toBe('ignored')
  })
  it('builds the payment link request in paise with the notes the webhook needs', () => {
    const b = razorpayLinkBody({ amountPaise: 118000, invoiceNo: 'IN/W1/2627/0001', clientName: 'Acme', email: 'a@b.in', invoiceId: 'inv-1', clientId: 'cl-1', warehouseId: 'wh-1' })
    expect(b).toMatchObject({ amount: 118000, currency: 'INR', accept_partial: false, notes: { invoice_id: 'inv-1', client_id: 'cl-1', warehouse_id: 'wh-1' } })
    expect(() => razorpayLinkBody({ amountPaise: 99.5, invoiceNo: 'x', clientName: 'x', invoiceId: 'i', clientId: 'c', warehouseId: 'w' })).toThrow()
    expect(() => razorpayLinkBody({ amountPaise: 0, invoiceNo: 'x', clientName: 'x', invoiceId: 'i', clientId: 'c', warehouseId: 'w' })).toThrow()
  })
  it('builds HTTP basic auth', () => {
    expect(razorpayBasicAuth('key', 'secret')).toBe(`Basic ${btoa('key:secret')}`)
  })
})
