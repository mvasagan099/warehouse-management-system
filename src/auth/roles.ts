import type { AppRole } from '../lib/types'

export type Area =
  | 'dashboard'
  | 'warehouses'
  | 'zones'
  | 'brigadeTypes'
  | 'slots'
  | 'users'
  | 'hiring'
  | 'audit'

/** Which roles can open each area (UI guard; the database enforces the same with RLS). */
export const AREA_ACCESS: Record<Area, readonly AppRole[]> = {
  dashboard: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF'],
  warehouses: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF'],
  zones: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF'],
  brigadeTypes: ['SUPER_ADMIN'],
  slots: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'STAFF'],
  users: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'],
  hiring: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'],
  audit: ['SUPER_ADMIN'],
}

/** Which roles can create/edit in each area. */
export const AREA_WRITE: Record<Area, readonly AppRole[]> = {
  dashboard: [],
  warehouses: ['SUPER_ADMIN'],
  zones: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'],
  brigadeTypes: ['SUPER_ADMIN'],
  slots: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'],
  users: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'],
  hiring: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'],
  audit: [],
}

export function canAccess(role: AppRole | null | undefined, area: Area): boolean {
  return !!role && AREA_ACCESS[area].includes(role)
}

export function canWrite(role: AppRole | null | undefined, area: Area): boolean {
  return !!role && AREA_WRITE[area].includes(role)
}

/** Roles a given user may create through the create-user Edge Function. */
export function creatableRoles(role: AppRole | null | undefined): AppRole[] {
  if (role === 'SUPER_ADMIN') return ['WAREHOUSE_MANAGER', 'STAFF']
  if (role === 'WAREHOUSE_MANAGER') return ['STAFF']
  return []
}

export const NAV_ITEMS: { area: Area; path: string; labelKey: string }[] = [
  { area: 'dashboard', path: '/', labelKey: 'nav.dashboard' },
  { area: 'warehouses', path: '/warehouses', labelKey: 'nav.warehouses' },
  { area: 'zones', path: '/zones', labelKey: 'nav.zones' },
  { area: 'brigadeTypes', path: '/brigade-types', labelKey: 'nav.brigadeTypes' },
  { area: 'slots', path: '/slots', labelKey: 'nav.slots' },
  { area: 'users', path: '/users', labelKey: 'nav.users' },
  { area: 'hiring', path: '/hiring', labelKey: 'nav.hiring' },
  { area: 'audit', path: '/audit', labelKey: 'nav.audit' },
  // EXTENSION POINT (Phase 2+): clients, contracts, rates, stock, lorry entry,
  // inward receipts, delivery challans, invoices, sensors, payments.
]

export function navFor(role: AppRole | null | undefined) {
  return NAV_ITEMS.filter((i) => canAccess(role, i.area))
}
