import { describe, expect, it } from 'vitest'
import { canAccess, canWrite, creatableRoles, navFor } from './roles'

describe('role access map', () => {
  it('gives the admin every page', () => {
    expect(navFor('SUPER_ADMIN').map((n) => n.area)).toEqual([
      'dashboard', 'warehouses', 'zones', 'brigadeTypes', 'slots', 'users', 'hiring', 'audit',
    ])
  })
  it('hides admin-only pages from managers', () => {
    const areas = navFor('WAREHOUSE_MANAGER').map((n) => n.area)
    expect(areas).not.toContain('audit')
    expect(areas).not.toContain('brigadeTypes')
    expect(areas).toContain('users')
  })
  it('makes staff read-only', () => {
    expect(canAccess('STAFF', 'zones')).toBe(true)
    expect(canWrite('STAFF', 'zones')).toBe(false)
    expect(canWrite('STAFF', 'slots')).toBe(false)
    expect(canAccess('STAFF', 'users')).toBe(false)
  })
  it('gives clients and anonymous users nothing', () => {
    expect(navFor('CLIENT')).toEqual([])
    expect(navFor(null)).toEqual([])
    expect(canAccess(undefined, 'dashboard')).toBe(false)
  })
  it('limits who can create which users', () => {
    expect(creatableRoles('SUPER_ADMIN')).toEqual(['WAREHOUSE_MANAGER', 'STAFF'])
    expect(creatableRoles('WAREHOUSE_MANAGER')).toEqual(['STAFF'])
    expect(creatableRoles('STAFF')).toEqual([])
  })
  it('only lets admins edit warehouses', () => {
    expect(canWrite('SUPER_ADMIN', 'warehouses')).toBe(true)
    expect(canWrite('WAREHOUSE_MANAGER', 'warehouses')).toBe(false)
  })
})
