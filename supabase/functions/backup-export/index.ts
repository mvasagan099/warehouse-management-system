// Edge Function: backup-export
// Nightly second copy of the key tables as JSON files in the private "backups" bucket (daily/YYYY-MM-DD/<table>.json), 14 days kept.
// Called by pg_cron through the database (x-cron-secret) or by an administrator. This is in addition to Supabase's own backups, not instead of them.
import { corsHeaders, json, requireAdmin, serviceClient } from '../_shared/http.ts'
import { guarded } from '../_shared/ops.ts'
import { BACKUP_TABLES, backupFolder, foldersToPrune } from '../_shared/ops-rules.ts'

const PAGE = 1000
const KEEP_DAYS = 14

Deno.serve(guarded('backup-export', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const cron = Deno.env.get('CRON_SECRET')
  if (!(!!cron && req.headers.get('x-cron-secret') === cron)) { const who = await requireAdmin(req); if (who instanceof Response) return who }

  const admin = serviceClient()
  const now = new Date()
  const folder = backupFolder(now)
  const summary: Record<string, number> = {}
  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from(table).select('*').range(from, from + PAGE - 1)
      if (error) return json(500, { error: `Export of ${table} failed`, table })
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    const { error } = await admin.storage.from('backups').upload(`${folder}/${table}.json`, new Blob([JSON.stringify(rows)], { type: 'application/json' }), { upsert: true })
    if (error) return json(500, { error: `Saving ${table} failed`, table })
    summary[table] = rows.length
  }
  const { data: dirs } = await admin.storage.from('backups').list('daily', { limit: 200 })
  for (const old of foldersToPrune((dirs ?? []).map((d) => d.name), now, KEEP_DAYS)) {
    const { data: files } = await admin.storage.from('backups').list(`daily/${old}`, { limit: 200 })
    if (files?.length) await admin.storage.from('backups').remove(files.map((f) => `daily/${old}/${f.name}`))
  }
  return json(200, { folder, tables: summary })
}))
