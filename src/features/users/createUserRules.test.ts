// Tests the authorisation rules used by the create-user Edge Function.
import { describe, expect, it } from 'vitest'
import { authorize, parseRequest, type Caller } from '../../../supabase/functions/create-user/rules.ts'

const W1 = '11111111-1111-1111-1111-111111111111'
const W2 = '22222222-2222-2222-2222-222222222222'
const req = (o: Record<string, unknown> = {}) => {
  const r = parseRequest({ email: 'New@Test.local', password: 'Secret-Pass123', full_name: ' New User ', role: 'STAFF', warehouse_ids: [W1], ...o })
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const admin: Caller = { id: 'a', role: 'SUPER_ADMIN', is_active: true, managedWarehouseIds: [] }
const manager: Caller = { id: 'm', role: 'WAREHOUSE_MANAGER', is_active: true, managedWarehouseIds: [W1] }

describe('create-user parseRequest', () => {
  it('normalises input', () => {
    expect(req()).toMatchObject({ email: 'new@test.local', full_name: 'New User', warehouse_ids: [W1] })
  })
  it('rejects bad input', () => {
    expect(parseRequest({ email: 'x', password: 'Secret-Pass123', full_name: 'A', role: 'STAFF', warehouse_ids: [W1] }).ok).toBe(false)
    expect(parseRequest({ email: 'a@b.co', password: 'short', full_name: 'A', role: 'STAFF', warehouse_ids: [W1] }).ok).toBe(false)
    expect(parseRequest({ email: 'a@b.co', password: 'Secret-Pass123', full_name: 'A', role: 'SUPER_ADMIN', warehouse_ids: [W1] }).ok).toBe(false)
    expect(parseRequest({ email: 'a@b.co', password: 'Secret-Pass123', full_name: 'A', role: 'STAFF', warehouse_ids: [W1, W2] }).ok).toBe(false)
    expect(parseRequest({ email: 'a@b.co', password: 'Secret-Pass123', full_name: 'A', role: 'STAFF', warehouse_ids: ['nope'] }).ok).toBe(false)
  })
})

describe('create-user client logins', () => {
  const C1 = '33333333-3333-3333-3333-333333333333'
  it('requires a client_id and no warehouses', () => {
    expect(parseRequest({ email: 'c@t.co', password: 'Secret-Pass123', full_name: 'C', role: 'CLIENT', warehouse_ids: [] }).ok).toBe(false)
    expect(parseRequest({ email: 'c@t.co', password: 'Secret-Pass123', full_name: 'C', role: 'CLIENT', client_id: C1, warehouse_ids: [W1] }).ok).toBe(false)
    expect(parseRequest({ email: 'c@t.co', password: 'Secret-Pass123', full_name: 'C', role: 'CLIENT', client_id: C1, warehouse_ids: [] }).ok).toBe(true)
  })
  it('rejects client_id on staff and managers', () => {
    expect(parseRequest({ email: 'a@t.co', password: 'Secret-Pass123', full_name: 'A', role: 'STAFF', client_id: C1, warehouse_ids: [W1] }).ok).toBe(false)
  })
  it('lets only an administrator create a client login', () => {
    const r = parseRequest({ email: 'c@t.co', password: 'Secret-Pass123', full_name: 'C', role: 'CLIENT', client_id: C1, warehouse_ids: [] })
    if (!r.ok) throw new Error(r.error)
    expect(authorize(admin, r.value).ok).toBe(true)
    expect(authorize(manager, r.value)).toMatchObject({ ok: false, status: 403 })
  })
})

describe('create-user authorize', () => {
  it('lets the admin create managers and staff, including from applicants', () => {
    expect(authorize(admin, req({ role: 'WAREHOUSE_MANAGER', warehouse_ids: [W1, W2] })).ok).toBe(true)
    expect(authorize(admin, req({ applicant_id: W2 })).ok).toBe(true)
  })
  it('lets a manager create staff only for their own warehouse', () => {
    expect(authorize(manager, req()).ok).toBe(true)
    expect(authorize(manager, req({ warehouse_ids: [W2] }))).toMatchObject({ ok: false, status: 403 })
    expect(authorize(manager, req({ role: 'WAREHOUSE_MANAGER' }))).toMatchObject({ ok: false, status: 403 })
    expect(authorize(manager, req({ applicant_id: W2 }))).toMatchObject({ ok: false, status: 403 })
  })
  it('denies staff, clients and inactive accounts', () => {
    expect(authorize({ ...manager, role: 'STAFF' }, req()).ok).toBe(false)
    expect(authorize({ ...manager, role: 'CLIENT' }, req()).ok).toBe(false)
    expect(authorize({ ...admin, is_active: false }, req()).ok).toBe(false)
    expect(authorize({ ...admin, role: null }, req()).ok).toBe(false)
  })
})

describe('create-user accountant logins', () => {
  it('needs no warehouses and no client', () => {
    expect(req({ role: 'ACCOUNTANT', warehouse_ids: [] })).toMatchObject({ role: 'ACCOUNTANT', warehouse_ids: [] })
    expect(parseRequest({ email: 'a@b.co', password: 'Secret-Pass123', full_name: 'A', role: 'ACCOUNTANT', warehouse_ids: [W1] }).ok).toBe(false)
    expect(parseRequest({ email: 'a@b.co', password: 'Secret-Pass123', full_name: 'A', role: 'ACCOUNTANT', warehouse_ids: [], client_id: W2 }).ok).toBe(false)
  })
  it('only an administrator can create one', () => {
    expect(authorize(admin, req({ role: 'ACCOUNTANT', warehouse_ids: [] })).ok).toBe(true)
    expect(authorize(manager, req({ role: 'ACCOUNTANT', warehouse_ids: [] })).ok).toBe(false)
  })
})
