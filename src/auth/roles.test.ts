import { describe, expect, it } from 'vitest'
import { canAccess, canDecide, canOperate, canWrite, creatableRoles, navFor } from './roles'

describe('role access map', () => {
  it('gives the admin every page', () => {
    expect(navFor('SUPER_ADMIN').map((n) => n.area)).toEqual([
      'dashboard', 'warehouses', 'zones', 'brigadeTypes', 'slots', 'clients', 'bookings', 'gate', 'receipts',
      'stock', 'dispatch', 'challans', 'labels', 'scan', 'users', 'hiring', 'audit',
      'invoices', 'payments', 'ledger', 'rates', 'billingReports', 'billingSettings',
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
  it('gives a client only its own portal pages', () => {
    expect(navFor('CLIENT').map((n) => n.area)).toEqual(['portal', 'bookings', 'receipts', 'stock', 'dispatch', 'challans', 'invoices', 'payments', 'ledger'])
    for (const area of ['dashboard', 'warehouses', 'zones', 'slots', 'clients', 'gate', 'users', 'audit', 'labels', 'scan', 'rates', 'billingReports', 'billingSettings'] as const)
      expect(canAccess('CLIENT', area)).toBe(false)
  })
  it('gives anonymous users nothing', () => {
    expect(navFor(null)).toEqual([])
    expect(canAccess(undefined, 'dashboard')).toBe(false)
  })
  it('limits approvals, cancellations and adjustments to managers and admins', () => {
    expect(canDecide('SUPER_ADMIN')).toBe(true)
    expect(canDecide('WAREHOUSE_MANAGER')).toBe(true)
    expect(canDecide('STAFF')).toBe(false)
    expect(canDecide('CLIENT')).toBe(false)
  })
  it('lets staff run the gate and picking but not manage clients', () => {
    expect(canWrite('STAFF', 'gate')).toBe(true)
    expect(canAccess('STAFF', 'clients')).toBe(false)
    expect(canOperate('STAFF')).toBe(true)
    expect(canOperate('CLIENT')).toBe(false)
  })
  it('limits who can create which users', () => {
    expect(creatableRoles('SUPER_ADMIN')).toEqual(['WAREHOUSE_MANAGER', 'STAFF', 'ACCOUNTANT'])
    expect(creatableRoles('WAREHOUSE_MANAGER')).toEqual(['STAFF'])
    expect(creatableRoles('STAFF')).toEqual([])
  })
  it('only lets admins edit warehouses', () => {
    expect(canWrite('SUPER_ADMIN', 'warehouses')).toBe(true)
    expect(canWrite('WAREHOUSE_MANAGER', 'warehouses')).toBe(false)
  })
  it('lets an accountant read and export billing but change nothing', () => {
    for (const area of ['invoices', 'payments', 'ledger', 'rates', 'billingReports', 'billingSettings', 'clients'] as const) {
      expect(canAccess('ACCOUNTANT', area)).toBe(true)
      expect(canWrite('ACCOUNTANT', area)).toBe(false)
    }
    for (const area of ['gate', 'stock', 'dispatch', 'users', 'scan'] as const) expect(canAccess('ACCOUNTANT', area)).toBe(false)
    expect(canDecide('ACCOUNTANT')).toBe(false)
    expect(canOperate('ACCOUNTANT')).toBe(false)
  })
  it('keeps rate cards and invoice issuing admin-only', () => {
    expect(canWrite('SUPER_ADMIN', 'rates')).toBe(true)
    expect(canWrite('SUPER_ADMIN', 'invoices')).toBe(true)
    for (const role of ['WAREHOUSE_MANAGER', 'STAFF', 'CLIENT'] as const) {
      expect(canWrite(role, 'rates')).toBe(false)
      expect(canWrite(role, 'invoices')).toBe(false)
    }
    expect(canAccess('WAREHOUSE_MANAGER', 'invoices')).toBe(true)
    expect(canAccess('STAFF', 'invoices')).toBe(false)
  })
})
