// Edge Function: signed-download
// Hands out a short-lived signed URL for a private file. The URL is created with the CALLER's own session, so Storage row security decides
// whether this person may read that file; guessing another client's path simply fails. Rate limited per user.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json, serviceClient } from '../_shared/http.ts'
import { allowed, guarded } from '../_shared/ops.ts'
import { parseDownloadRequest, RATE } from '../_shared/ops-rules.ts'

Deno.serve(guarded('signed-download', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Not signed in' })
  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: u, error: uErr } = await asCaller.auth.getUser(authHeader.slice(7))
  if (uErr || !u.user) return json(401, { error: 'Invalid session' })
  if (!(await allowed(serviceClient(), `dl:${u.user.id}`, 60, RATE.downloadPerUserPerMin))) return json(429, { error: 'Too many downloads. Wait a minute and try again.' })
  let body: unknown
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  const parsed = parseDownloadRequest(body)
  if (!parsed.ok) return json(400, { error: parsed.error })
  const { data, error } = await asCaller.storage.from(parsed.bucket).createSignedUrl(parsed.path, parsed.expiresIn)
  if (error || !data) return json(404, { error: 'File not found' })        // same answer for "missing" and "not yours"
  return json(200, { url: data.signedUrl, expiresIn: parsed.expiresIn })
}))
