// Pure helpers for the billing Edge Functions (no Deno or network imports, so Vitest tests this same file).
// Money is integer paise. Secrets are read by the callers from Edge Function secrets and passed in; none is stored here.

export const toRupees = (paise: number): string => {
  const abs = Math.abs(paise)
  const rupees = String(Math.floor(abs / 100))
  const last3 = rupees.slice(-3)
  const rest = rupees.slice(0, -3)
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3
  return `${paise < 0 ? '-' : ''}${grouped}.${String(abs % 100).padStart(2, '0')}`
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isEmail = (s: unknown): s is string => typeof s === 'string' && EMAIL_RE.test(s.trim())

export interface InvoiceMailInput {
  supplierName: string
  clientName: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  grandTotalPaise: number
  outstandingPaise: number
  payLink?: string | null
  terms?: string | null
}

export function buildInvoiceEmail(i: InvoiceMailInput): { subject: string; html: string; text: string } {
  const subject = `Invoice ${i.invoiceNo} from ${i.supplierName}`
  const lines = [
    `Dear ${i.clientName},`,
    ``,
    `Please find attached invoice ${i.invoiceNo} dated ${i.invoiceDate}.`,
    `Invoice total: Rs. ${toRupees(i.grandTotalPaise)}`,
    `Amount due: Rs. ${toRupees(i.outstandingPaise)} by ${i.dueDate}.`,
  ]
  if (i.payLink) lines.push(``, `Pay online: ${i.payLink}`)
  if (i.terms) lines.push(``, i.terms)
  lines.push(``, `Regards,`, i.supplierName)
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">${lines
    .map((l) => (l === '' ? '<br/>' : `<p style="margin:0 0 6px">${escapeHtml(l)}</p>`))
    .join('')}</div>`
  return { subject, html, text: lines.join('\n') }
}

export function buildReminderEmail(i: InvoiceMailInput & { daysOverdue: number }): { subject: string; html: string; text: string } {
  const subject = `Payment reminder: invoice ${i.invoiceNo} is ${i.daysOverdue} day${i.daysOverdue === 1 ? '' : 's'} overdue`
  const lines = [
    `Dear ${i.clientName},`,
    ``,
    `Invoice ${i.invoiceNo} dated ${i.invoiceDate} was due on ${i.dueDate} and Rs. ${toRupees(i.outstandingPaise)} is still outstanding.`,
    `Please arrange payment at the earliest. If you have already paid, kindly ignore this message.`,
  ]
  if (i.payLink) lines.push(``, `Pay online: ${i.payLink}`)
  lines.push(``, `Regards,`, i.supplierName)
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">${lines
    .map((l) => (l === '' ? '<br/>' : `<p style="margin:0 0 6px">${escapeHtml(l)}</p>`))
    .join('')}</div>`
  return { subject, html, text: lines.join('\n') }
}

/** Resend "send email" request body. The PDF (if any) is attached as base64. */
export function resendPayload(args: { from: string; to: string; subject: string; html: string; text: string; pdfBase64?: string; pdfName?: string }) {
  return {
    from: args.from,
    to: [args.to],
    subject: args.subject,
    html: args.html,
    text: args.text,
    ...(args.pdfBase64 ? { attachments: [{ filename: args.pdfName ?? 'invoice.pdf', content: args.pdfBase64 }] } : {}),
  }
}

// ---------------------------------- Razorpay ----------------------------------

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
}

/** Constant-time comparison of the webhook signature (X-Razorpay-Signature) with HMAC-SHA256(rawBody, webhookSecret). */
export async function verifyRazorpaySignature(rawBody: string, signature: string | null | undefined, secret: string): Promise<boolean> {
  if (!signature || !secret) return false
  const expected = await hmacSha256Hex(secret, rawBody)
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

export interface PaidEvent {
  kind: 'paid'
  externalRef: string          // Razorpay payment id: makes retries idempotent
  amountPaise: number
  invoiceId: string | null
  clientId: string
  warehouseId: string
  reference: string
}
export type ParsedEvent = PaidEvent | { kind: 'ignored'; reason: string }

/** Reads a Razorpay webhook body (payment_link.paid). The invoice, client and warehouse come from the notes we set when creating the link. */
export function parseRazorpayEvent(body: unknown): ParsedEvent {
  const b = body as { event?: string; payload?: { payment?: { entity?: Record<string, any> }; payment_link?: { entity?: Record<string, any> } } } | null
  if (!b || typeof b !== 'object') return { kind: 'ignored', reason: 'empty body' }
  if (b.event !== 'payment_link.paid' && b.event !== 'payment.captured') return { kind: 'ignored', reason: `event ${b.event ?? '?'} not handled` }
  const pay = b.payload?.payment?.entity
  const link = b.payload?.payment_link?.entity
  if (!pay?.id) return { kind: 'ignored', reason: 'no payment in payload' }
  if (pay.status && pay.status !== 'captured') return { kind: 'ignored', reason: `payment status ${pay.status}` }
  const notes = { ...(link?.notes ?? {}), ...(pay.notes ?? {}) } as Record<string, string>
  const amount = Number(pay.amount ?? link?.amount_paid)
  if (!Number.isSafeInteger(amount) || amount <= 0) return { kind: 'ignored', reason: 'bad amount' }
  if (!notes.client_id || !notes.warehouse_id) return { kind: 'ignored', reason: 'payment was not created by this system (no notes)' }
  return {
    kind: 'paid',
    externalRef: String(pay.id),
    amountPaise: amount,
    invoiceId: notes.invoice_id || null,
    clientId: notes.client_id,
    warehouseId: notes.warehouse_id,
    reference: String(pay.id),
  }
}

/** Body for POST https://api.razorpay.com/v1/payment_links. Amount is in paise already. */
export function razorpayLinkBody(args: { amountPaise: number; invoiceNo: string; clientName: string; email?: string | null; phone?: string | null;
  invoiceId: string; clientId: string; warehouseId: string; expiresAtUnix?: number }) {
  if (!Number.isSafeInteger(args.amountPaise) || args.amountPaise <= 0) throw new Error('Amount must be a positive whole number of paise')
  return {
    amount: args.amountPaise,
    currency: 'INR',
    accept_partial: false,
    reference_id: args.invoiceId.slice(0, 40),
    description: `Invoice ${args.invoiceNo}`,
    customer: { name: args.clientName, ...(args.email ? { email: args.email } : {}), ...(args.phone ? { contact: args.phone } : {}) },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { invoice_id: args.invoiceId, client_id: args.clientId, warehouse_id: args.warehouseId, invoice_no: args.invoiceNo },
    ...(args.expiresAtUnix ? { expire_by: args.expiresAtUnix } : {}),
  }
}

export function razorpayBasicAuth(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`
}

/** Days overdue, in whole days, from ISO dates (yyyy-mm-dd). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000)
}
