// Pure helpers for the Phase 5 Edge Functions (no Deno or network imports, so Vitest tests the same file).

export const DOWNLOAD_BUCKETS = ['invoices', 'signatures', 'gate-photos', 'tickets', 'hr', 'coldchain'] as const

/** Validates a signed-download request. Paths may not climb out of the bucket. */
export function parseDownloadRequest(body: unknown): { ok: true; bucket: string; path: string; expiresIn: number } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Send a JSON object' }
  const b = body as Record<string, unknown>
  if (typeof b.bucket !== 'string' || !(DOWNLOAD_BUCKETS as readonly string[]).includes(b.bucket)) return { ok: false, error: 'Unknown bucket' }
  if (typeof b.path !== 'string' || b.path.length === 0 || b.path.length > 300) return { ok: false, error: 'A file path is required' }
  if (b.path.startsWith('/') || b.path.split('/').some((p) => p === '..' || p === '') || /[\u0000-\u001f]/.test(b.path)) return { ok: false, error: 'Invalid path' }
  const expiresIn = typeof b.expiresIn === 'number' ? Math.min(Math.max(Math.floor(b.expiresIn), 10), 300) : 60
  return { ok: true, bucket: b.bucket, path: b.path, expiresIn }
}

/** Tables copied by the nightly export. Personal or secret tables (employee_private, device_keys, internal_secrets) are never exported. */
export const BACKUP_TABLES = [
  'warehouses', 'zones', 'brigade_types', 'brigade_slots', 'clients', 'client_groups', 'company_master', 'contracts', 'space_bookings', 'slot_allocations',
  'gate_entries', 'gate_entry_lines', 'inward_receipts', 'inward_receipt_lines', 'stock_items', 'stock_movements', 'dispatch_requests', 'dispatch_request_lines',
  'dispatch_picks', 'delivery_challans', 'delivery_challan_lines', 'labour_entries', 'rate_cards', 'rent_rates', 'labour_rates', 'tax_rules', 'other_charges',
  'invoices', 'invoice_lines', 'invoice_tax_lines', 'adjustment_notes', 'adjustment_note_lines', 'payments', 'payment_allocations', 'opening_balances',
  'sensors', 'alert_rules', 'alerts', 'alert_evidence', 'alert_stock', 'equipment', 'maintenance_tasks', 'app_settings', 'doc_types',
  'employees', 'vacancies', 'shifts', 'attendance',
] as const

export function backupFolder(now: Date): string {
  return `daily/${now.toISOString().slice(0, 10)}`
}

/** Folders older than `keepDays` days (names like daily/2026-11-01) that should be deleted. */
export function foldersToPrune(names: string[], now: Date, keepDays: number): string[] {
  const cutoff = new Date(now.getTime() - keepDays * 86400000).toISOString().slice(0, 10)
  return names.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n) && n < cutoff)
}

export interface SentryDsn { publicKey: string; host: string; projectId: string }
export function parseDsn(dsn: string | undefined | null): SentryDsn | null {
  if (!dsn) return null
  const m = /^https:\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/i.exec(dsn.trim())
  return m ? { publicKey: m[1], host: m[2], projectId: m[3] } : null
}

/** A Sentry envelope for one error event, sent with fetch (no SDK needed in Deno). Request bodies and keys are never included. */
export function sentryEnvelope(dsn: SentryDsn, fn: string, err: unknown, now = new Date()): string {
  const e = err instanceof Error ? err : new Error(String(err))
  const eventId = crypto.randomUUID().replace(/-/g, '')
  const header = { event_id: eventId, sent_at: now.toISOString(), dsn: `https://${dsn.publicKey}@${dsn.host}/${dsn.projectId}` }
  const event = {
    event_id: eventId, timestamp: now.getTime() / 1000, platform: 'javascript', level: 'error', server_name: fn, tags: { function: fn },
    exception: { values: [{ type: e.name, value: e.message.slice(0, 500), stacktrace: undefined }] },
  }
  const body = JSON.stringify(event)
  return [JSON.stringify(header), JSON.stringify({ type: 'event', length: body.length }), body].join('\n')
}

export const RATE = { ingestPerKeyPerMin: 300, downloadPerUserPerMin: 60, createUserPerCallerPerHour: 30 } as const
