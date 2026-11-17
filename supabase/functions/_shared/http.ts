// Small Deno helpers shared by the billing Edge Functions. Secrets are read from Edge Function secrets only.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

export const serviceClient = (): SupabaseClient =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

/** Returns the caller's client when the request carries the JWT of an active SUPER_ADMIN; otherwise a Response to send back. */
export async function requireAdmin(req: Request): Promise<{ asCaller: SupabaseClient; userId: string } | Response> {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Not signed in' })
  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await asCaller.auth.getUser(authHeader.slice(7))
  if (error || !data.user) return json(401, { error: 'Invalid session' })
  const { data: isAdmin, error: adminErr } = await asCaller.rpc('is_admin')
  if (adminErr || isAdmin !== true) return json(403, { error: 'Only an administrator can do this' })
  return { asCaller, userId: data.user.id }
}

export async function setting(admin: SupabaseClient, key: string): Promise<any> {
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle()
  return data?.value ?? {}
}

export const base64FromBytes = (bytes: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
