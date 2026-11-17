// Edge Function: create-user
// Creates WAREHOUSE_MANAGER / STAFF accounts (and, for admins, CLIENT logins linked to a client). The service key lives ONLY here
// (server side); the browser calls this function with the user's own JWT.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { authorize, parseRequest, type AppRole } from './rules.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Not signed in' })

  // Client acting AS the caller (RLS applies, audit log records the caller)
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // Privileged client (auth admin API only)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: userData, error: userErr } = await asCaller.auth.getUser(authHeader.slice(7))
  if (userErr || !userData.user) return json(401, { error: 'Invalid session' })
  const callerId = userData.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const parsed = parseRequest(body)
  if (!parsed.ok) return json(400, { error: parsed.error })
  const input = parsed.value

  const [{ data: profile }, { data: managed }] = await Promise.all([
    admin.from('profiles').select('role, is_active, deleted_at').eq('id', callerId).maybeSingle(),
    admin.from('warehouse_managers').select('warehouse_id').eq('user_id', callerId).is('deleted_at', null),
  ])

  const decision = authorize(
    {
      id: callerId,
      role: (profile && !profile.deleted_at ? profile.role : null) as AppRole | null,
      is_active: !!profile?.is_active,
      managedWarehouseIds: (managed ?? []).map((m) => m.warehouse_id as string),
    },
    input,
  )
  if (!decision.ok) return json(decision.status, { error: decision.error })

  if (input.role === 'CLIENT') {
    // The client must exist and be active
    const { data: client } = await admin
      .from('clients')
      .select('id, status, deleted_at')
      .eq('id', input.client_id!)
      .maybeSingle()
    if (!client || client.deleted_at) return json(404, { error: 'Client not found' })
    if (client.status === 'INACTIVE') return json(400, { error: 'Client is inactive' })
  } else {
    // Warehouses must exist and be active
    const { data: whs, error: whErr } = await admin
      .from('warehouses')
      .select('id')
      .in('id', input.warehouse_ids)
      .is('deleted_at', null)
      .eq('is_active', true)
    if (whErr) return json(500, { error: whErr.message })
    if ((whs ?? []).length !== input.warehouse_ids.length)
      return json(400, { error: 'One or more warehouses do not exist or are inactive' })
  }

  // Applicant (admin only, checked in authorize) must exist and not already have an account
  if (input.applicant_id) {
    const { data: app } = await admin
      .from('applicants')
      .select('id, user_id, deleted_at')
      .eq('id', input.applicant_id)
      .maybeSingle()
    if (!app || app.deleted_at) return json(404, { error: 'Applicant not found' })
    if (app.user_id) return json(409, { error: 'Applicant already has an account' })
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, phone: input.phone },
    app_metadata: {
      role: input.role,
      warehouse_id: input.role === 'STAFF' ? input.warehouse_ids[0] : null,
      client_id: input.role === 'CLIENT' ? input.client_id : null,
      must_change_password: true,
      created_by: callerId,
    },
  })
  if (createErr || !created.user) {
    const msg = createErr?.message ?? 'Could not create user'
    return json(/already|exists|registered/i.test(msg) ? 409 : 400, { error: msg })
  }
  const newUserId = created.user.id

  try {
    const { data: newProfile, error: profErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', newUserId)
      .single()
    if (profErr || newProfile?.role !== input.role) throw new Error('Profile was not provisioned with the requested role')

    if (input.role === 'WAREHOUSE_MANAGER') {
      const { error } = await asCaller
        .from('warehouse_managers')
        .insert(input.warehouse_ids.map((warehouse_id) => ({ warehouse_id, user_id: newUserId })))
      if (error) throw error
    }
    if (input.applicant_id) {
      const { error } = await asCaller
        .from('applicants')
        .update({ user_id: newUserId, status: 'JOINED' })
        .eq('id', input.applicant_id)
      if (error) throw error
    }
  } catch (e) {
    // roll back the auth user so we never leave a half-created account
    await admin.auth.admin.deleteUser(newUserId)
    return json(500, { error: (e as { message?: string }).message ?? 'Failed to finish user setup' })
  }

  return json(201, { id: newUserId, email: input.email, role: input.role })
})
