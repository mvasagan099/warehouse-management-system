// Pure helpers for the cold-chain Edge Functions (no Deno or network imports, so Vitest tests this same file).
// Semantic checks (value ranges, timestamps, sensor ownership, duplicates) are done in Postgres by ingest_readings(); this file only
// checks the shape of the request and reads the device key.

export interface RawReading { sensor: string; value: number; unit?: string; timestamp?: string; battery?: number }
export type ParsedIngest = { ok: true; readings: RawReading[]; key: string | null } | { ok: false; error: string }
export const MAX_BATCH = 100
export const MAX_BODY_BYTES = 64 * 1024

/** SHA-256 hex of the device key: the database stores and compares only this hash. */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Key from the X-Device-Key header, an "Authorization: Bearer wms_..." header, or a "key" field in the body (for tiny devices). */
export function extractKey(headers: { get(name: string): string | null }, body: unknown): string | null {
  const h = headers.get('x-device-key')?.trim()
  if (h) return h
  const a = headers.get('authorization')?.trim()
  if (a && /^bearer\s+wms_/i.test(a)) return a.replace(/^bearer\s+/i, '').trim()
  const k = body && typeof body === 'object' ? (body as Record<string, unknown>).key : undefined
  return typeof k === 'string' && k.trim() ? k.trim() : null
}

/** Accepts one reading, an array of readings, or { key?, readings: [...] }. Up to 100 readings per request. */
export function parseIngestBody(body: unknown): ParsedIngest {
  if (body === null || typeof body !== 'object') return { ok: false, error: 'Send a JSON object or array' }
  const obj = Array.isArray(body) ? null : (body as Record<string, unknown>)
  const list: unknown[] = Array.isArray(body) ? body : Array.isArray(obj?.readings) ? (obj!.readings as unknown[]) : [body]
  if (list.length === 0) return { ok: false, error: 'No readings in the request' }
  if (list.length > MAX_BATCH) return { ok: false, error: `At most ${MAX_BATCH} readings per request` }
  const readings: RawReading[] = []
  for (let i = 0; i < list.length; i++) {
    const r = list[i] as Record<string, unknown> | null
    if (!r || typeof r !== 'object' || Array.isArray(r)) return { ok: false, error: `Reading ${i}: must be an object` }
    if (typeof r.sensor !== 'string' || !r.sensor.trim() || r.sensor.length > 64) return { ok: false, error: `Reading ${i}: "sensor" (the serial number) is required` }
    if (typeof r.value !== 'number' || !Number.isFinite(r.value)) return { ok: false, error: `Reading ${i}: "value" must be a number` }
    if (r.unit !== undefined && (typeof r.unit !== 'string' || r.unit.length > 8)) return { ok: false, error: `Reading ${i}: "unit" must be a short string` }
    if (r.timestamp !== undefined && (typeof r.timestamp !== 'string' || r.timestamp.length > 40 || Number.isNaN(Date.parse(r.timestamp)))) return { ok: false, error: `Reading ${i}: "timestamp" must be ISO 8601, e.g. 2026-11-18T09:30:00Z` }
    if (r.battery !== undefined && (typeof r.battery !== 'number' || !Number.isInteger(r.battery) || r.battery < 0 || r.battery > 100)) return { ok: false, error: `Reading ${i}: "battery" must be a whole number 0-100` }
    readings.push({ sensor: r.sensor.trim(), value: r.value, ...(r.unit !== undefined ? { unit: r.unit as string } : {}),
      ...(r.timestamp !== undefined ? { timestamp: new Date(r.timestamp as string).toISOString() } : {}), ...(r.battery !== undefined ? { battery: r.battery as number } : {}) })
  }
  return { ok: true, readings, key: extractKey({ get: () => null }, body) }
}

/** HTTP status for the ingest answer: 200 when something was stored (or was already there), 422 when every reading was rejected. */
export function ingestStatus(result: { accepted: number; duplicates: number; rejected: unknown[] }): number {
  return result.accepted + result.duplicates > 0 || result.rejected.length === 0 ? 200 : 422
}

/** Database error codes raised by ingest_readings(). */
export function ingestErrorStatus(code: string | undefined): number {
  if (code === 'WMS40') return 401
  if (code === 'WMS41') return 400
  return 500
}

// ---------------------------------- notifications: provider-neutral ----------------------------------
export type Channel = 'EMAIL' | 'WHATSAPP' | 'SMS'
export interface Message { to: string; subject: string | null; body: string }
export type SendResult = { ok: true } | { ok: false; error: string; skipped?: boolean }
export interface Notifier { channel: Channel; send(msg: Message): Promise<SendResult> }

export function resendBody(from: string, m: Message) {
  return { from, to: [m.to], subject: m.subject ?? 'Cold-chain notice', text: m.body }
}

export function emailNotifier(apiKey: string, from: string, fetchFn: typeof fetch = fetch): Notifier {
  return {
    channel: 'EMAIL',
    async send(m) {
      const res = await fetchFn('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(resendBody(from, m)) })
      return res.ok ? { ok: true } : { ok: false, error: `Resend answered ${res.status}` }
    },
  }
}

/** WhatsApp and SMS are a stub: a real provider implements the same Notifier interface later (see docs/cold-chain.md). */
export function stubNotifier(channel: 'WHATSAPP' | 'SMS'): Notifier {
  return { channel, async send() { return { ok: false, skipped: true, error: `${channel} provider is not configured (stub)` } } }
}

export function outcome(r: SendResult): { status: 'SENT' | 'FAILED' | 'SKIPPED'; error: string | null } {
  if (r.ok) return { status: 'SENT', error: null }
  return { status: r.skipped ? 'SKIPPED' : 'FAILED', error: r.error }
}
