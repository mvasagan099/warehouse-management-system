// Pure authorisation + validation rules for the create-user Edge Function.
// No Deno / network imports here so the same file is unit-tested by Vitest.

export type AppRole = 'SUPER_ADMIN' | 'WAREHOUSE_MANAGER' | 'STAFF' | 'CLIENT'
export type CreatableRole = 'WAREHOUSE_MANAGER' | 'STAFF' | 'CLIENT'

export interface CreateUserRequest {
  email: string
  password: string
  full_name: string
  phone?: string | null
  role: CreatableRole
  warehouse_ids: string[]
  client_id?: string | null
  applicant_id?: string | null
}

export interface Caller {
  id: string
  role: AppRole | null
  is_active: boolean
  managedWarehouseIds: string[]
}

export type Decision = { ok: true } | { ok: false; status: number; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MIN_PASSWORD_LENGTH = 8

export function parseRequest(body: unknown): { ok: true; value: CreateUserRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' }
  const b = body as Record<string, unknown>
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  const password = typeof b.password === 'string' ? b.password : ''
  const full_name = typeof b.full_name === 'string' ? b.full_name.trim() : ''
  const phone = typeof b.phone === 'string' && b.phone.trim() ? b.phone.trim() : null
  const role = b.role
  const warehouse_ids = Array.isArray(b.warehouse_ids) ? b.warehouse_ids : []
  const applicant_id = typeof b.applicant_id === 'string' && b.applicant_id ? b.applicant_id : null
  const client_id = typeof b.client_id === 'string' && b.client_id ? b.client_id : null

  if (!EMAIL_RE.test(email)) return { ok: false, error: 'A valid email is required' }
  if (password.length < MIN_PASSWORD_LENGTH)
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
  if (!full_name) return { ok: false, error: 'Full name is required' }
  if (role !== 'WAREHOUSE_MANAGER' && role !== 'STAFF' && role !== 'CLIENT')
    return { ok: false, error: 'Role must be WAREHOUSE_MANAGER, STAFF or CLIENT' }
  if (!warehouse_ids.every((w) => typeof w === 'string' && UUID_RE.test(w)))
    return { ok: false, error: 'warehouse_ids must be UUIDs' }
  const unique = [...new Set(warehouse_ids as string[])]
  if (applicant_id && !UUID_RE.test(applicant_id)) return { ok: false, error: 'applicant_id must be a UUID' }
  if (role === 'CLIENT') {
    if (!client_id || !UUID_RE.test(client_id)) return { ok: false, error: 'A client login needs a valid client_id' }
    if (unique.length > 0) return { ok: false, error: 'A client login has no warehouses' }
    if (applicant_id) return { ok: false, error: 'A client login cannot come from an applicant' }
  } else {
    if (client_id) return { ok: false, error: 'client_id is only for client logins' }
    if (unique.length === 0) return { ok: false, error: 'At least one warehouse is required' }
    if (role === 'STAFF' && unique.length !== 1)
      return { ok: false, error: 'Staff must belong to exactly one warehouse' }
  }

  return { ok: true, value: { email, password, full_name, phone, role, warehouse_ids: unique, client_id, applicant_id } }
}

/**
 * Who may create whom:
 *  - SUPER_ADMIN: managers (any warehouses), staff (any warehouse) and client logins; may link an applicant.
 *  - WAREHOUSE_MANAGER: STAFF only, only for a warehouse they manage; no applicant linking.
 *  - everyone else: nobody.
 */
export function authorize(caller: Caller, req: CreateUserRequest): Decision {
  if (!caller.is_active || !caller.role) return { ok: false, status: 403, error: 'Account is not active' }

  if (caller.role === 'SUPER_ADMIN') return { ok: true }

  if (caller.role === 'WAREHOUSE_MANAGER') {
    if (req.role === 'CLIENT')
      return { ok: false, status: 403, error: 'Only an administrator can create client logins' }
    if (req.role !== 'STAFF') return { ok: false, status: 403, error: 'Managers can only create staff' }
    if (req.applicant_id)
      return { ok: false, status: 403, error: 'Only an administrator can create accounts from applicants' }
    const allowed = req.warehouse_ids.every((w) => caller.managedWarehouseIds.includes(w))
    if (!allowed) return { ok: false, status: 403, error: 'You can only create staff for your own warehouse' }
    return { ok: true }
  }

  return { ok: false, status: 403, error: 'Not allowed to create users' }
}
