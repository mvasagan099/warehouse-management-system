// Edge Function: notify-alert. Sends what the database queued in notification_outbox (alert messages, approved client notices, maintenance
// reminders). Called every minute by the database (pg_net, see dispatch_notifications) with the x-cron-secret header, or by an administrator.
// Email goes through Resend (RESEND_API_KEY secret). WhatsApp and SMS use a provider-neutral interface with a STUB only.
import { emailNotifier, outcome, stubNotifier, type Channel, type Notifier } from '../_shared/coldchain-rules.ts'
import { guarded } from '../_shared/ops.ts'
import { corsHeaders, json, requireAdmin, serviceClient, setting } from '../_shared/http.ts'

Deno.serve(guarded('notify-alert', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const cron = Deno.env.get('CRON_SECRET')
  if (!(!!cron && req.headers.get('x-cron-secret') === cron)) { const who = await requireAdmin(req); if (who instanceof Response) return who }

  const admin = serviceClient()
  const key = Deno.env.get('RESEND_API_KEY'); const email = await setting(admin, 'email'); const from = (email.from as string) || Deno.env.get('RESEND_FROM') || ''
  const notifiers: Record<Channel, Notifier | null> = { EMAIL: key && from ? emailNotifier(key, from) : null, WHATSAPP: stubNotifier('WHATSAPP'), SMS: stubNotifier('SMS') }

  const { data: queue } = await admin.from('notification_outbox').select('*').eq('status', 'PENDING').order('created_at').limit(50)
  let sent = 0, skipped = 0, failed = 0
  for (const m of queue ?? []) {
    const n = notifiers[m.channel as Channel]
    const result = n ? await n.send({ to: m.to_address, subject: m.subject, body: m.body }).catch((e) => ({ ok: false as const, error: String(e?.message ?? e) }))
                     : { ok: false as const, skipped: true, error: 'Email is not configured (RESEND_API_KEY and a From address)' }
    const o = outcome(result)
    await admin.from('notification_outbox').update({ status: o.status, error: o.error, attempts: m.attempts + 1, sent_at: o.status === 'SENT' ? new Date().toISOString() : null }).eq('id', m.id)
    if (o.status === 'SENT') sent++; else if (o.status === 'SKIPPED') skipped++; else failed++
  }
  return json(200, { sent, skipped, failed })
}))
