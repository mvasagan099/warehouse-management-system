// Edge Function: ingest-reading. Sensors and gateways POST readings here over HTTPS (deployed WITHOUT user-JWT verification:
// devices authenticate with their own key). The only writer of sensor readings.
//   POST  X-Device-Key: wms_...   {"sensor":"FRZ-01","value":-19.4,"unit":"C","timestamp":"2026-11-18T09:30:00Z"}
//   or    {"readings":[{...},{...}]}  (up to 100)
// EXTENSION POINT (MQTT): a bridge that subscribes to a broker can call this same endpoint, or call ingest_readings() with the key hash.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { extractKey, ingestErrorStatus, ingestStatus, MAX_BODY_BYTES, parseIngestBody, sha256Hex } from '../_shared/coldchain-rules.ts'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' })
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Request too large' })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return json(400, { error: 'Invalid JSON' }) }

  const key = extractKey(req.headers, body)
  if (!key) return json(401, { error: 'Missing device key (X-Device-Key header)' })
  const parsed = parseIngestBody(body)
  if (!parsed.ok) return json(400, { error: parsed.error })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.rpc('ingest_readings', { p_key_hash: await sha256Hex(key), p_readings: parsed.readings })
  if (error) {
    const status = ingestErrorStatus(error.code)
    return json(status, { error: status === 401 ? 'Invalid or revoked device key' : status === 400 ? error.message : 'Could not store the readings' })
  }
  const result = data as { accepted: number; duplicates: number; rejected: { index: number; sensor: string; reason: string }[] }
  return json(ingestStatus(result), result)
})
