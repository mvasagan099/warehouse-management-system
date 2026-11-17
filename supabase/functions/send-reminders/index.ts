// Edge Function: send-reminders. Sends the overdue-payment emails queued by the database (reminder_queue, filled by the nightly
// mark_overdue_invoices job). Call it from the app (admin) or from a scheduler with the x-cron-secret header (CRON_SECRET secret).
import { buildReminderEmail, daysBetween, isEmail, resendPayload } from '../_shared/billing-rules.ts'
import { corsHeaders, json, requireAdmin, serviceClient, setting } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const cron = Deno.env.get('CRON_SECRET')
  const viaCron = !!cron && req.headers.get('x-cron-secret') === cron
  if (!viaCron) { const who = await requireAdmin(req); if (who instanceof Response) return who }

  const admin = serviceClient()
  const email = await setting(admin, 'email')
  const key = Deno.env.get('RESEND_API_KEY'); const from = (email.from as string) || Deno.env.get('RESEND_FROM') || ''
  if (!email.enabled || !key || !from) return json(409, { error: 'Email is switched off or not configured' })

  const { data: queue } = await admin.from('reminder_queue').select('id, invoice_id, days_after_due').eq('status', 'PENDING').order('created_at').limit(50)
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
  let sent = 0, skipped = 0, failed = 0
  for (const q of queue ?? []) {
    const mark = (status: string, error?: string) => admin.from('reminder_queue').update({ status, error: error ?? null, sent_at: status === 'SENT' ? new Date().toISOString() : null }).eq('id', q.id)
    const { data: inv } = await admin.from('invoices').select('*').eq('id', q.invoice_id).maybeSingle()
    const due = inv ? inv.grand_total_paise - inv.paid_paise - inv.credit_paise : 0
    if (!inv || inv.status !== 'OVERDUE' || due <= 0) { await mark('SKIPPED', 'no longer overdue'); skipped++; continue }
    const { data: client } = await admin.from('clients').select('company_name, email').eq('id', inv.client_id).maybeSingle()
    if (!isEmail(client?.email)) { await mark('SKIPPED', 'client has no email'); skipped++; continue }
    const supplier = (inv.supplier_snapshot ?? {}) as Record<string, string>
    const mail = buildReminderEmail({ supplierName: supplier.legal_name || supplier.name || 'Warehouse', clientName: client!.company_name, invoiceNo: inv.invoice_no,
      invoiceDate: inv.invoice_date, dueDate: inv.due_date, grandTotalPaise: inv.grand_total_paise, outstandingPaise: due, daysOverdue: daysBetween(inv.due_date, today) })
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resendPayload({ from, to: client!.email as string, ...mail })) })
    if (res.ok) { await mark('SENT'); sent++ } else { await mark('FAILED', `provider answered ${res.status}`); failed++ }
  }
  return json(200, { sent, skipped, failed })
})
