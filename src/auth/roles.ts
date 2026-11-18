import type { AppRole } from '../lib/types'

export type Area =
  | 'dashboard'
  | 'portal'
  | 'warehouses'
  | 'zones'
  | 'brigadeTypes'
  | 'slots'
  | 'clients'
  | 'bookings'
  | 'gate'
  | 'receipts'
  | 'stock'
  | 'dispatch'
  | 'challans'
  | 'labels'
  | 'scan'
  | 'users'
  | 'hiring'
  | 'audit'
  | 'rates'
  | 'invoices'
  | 'payments'
  | 'ledger'
  | 'billingReports'
  | 'billingSettings'
  | 'coldChain'
  | 'sensors'
  | 'manualReading'
  | 'alerts'
  | 'alertRules'
  | 'coldReports'
  | 'equipment'
  | 'staff'
  | 'attendance'
  | 'imports'
  | 'support'
  | 'profile'
  | 'documents'
  | 'notices'
  | 'ops'

const A: AppRole = 'SUPER_ADMIN'
const M: AppRole = 'WAREHOUSE_MANAGER'
const S: AppRole = 'STAFF'
const C: AppRole = 'CLIENT'
const X: AppRole = 'ACCOUNTANT'

/** Which roles can open each area (UI guard; the database enforces the same with RLS). */
export const AREA_ACCESS: Record<Area, readonly AppRole[]> = {
  dashboard: [A, M, S],
  portal: [C],
  warehouses: [A, M, S, X],
  zones: [A, M, S],
  brigadeTypes: [A],
  slots: [A, M, S],
  clients: [A, M, X],
  bookings: [A, M, C],
  gate: [A, M, S],
  receipts: [A, M, S, C],
  stock: [A, M, S, C],
  dispatch: [A, M, S, C],
  challans: [A, M, S, C],
  labels: [A, M, S],
  scan: [A, M, S],
  users: [A, M],
  hiring: [A, M],
  audit: [A],
  rates: [A, X],
  invoices: [A, X, M, C],   // managers: their warehouses, read only; clients: their own
  payments: [A, X, C],
  ledger: [A, X, C],
  billingReports: [A, X],
  billingSettings: [A, X],
  coldChain: [A, M, S],
  sensors: [A, M, S],
  manualReading: [A, M, S],
  alerts: [A, M, S],
  alertRules: [A, M, S],
  coldReports: [A, M, S, C],
  equipment: [A, M, S],
  staff: [A, M],
  attendance: [A, M, S],
  imports: [A],
  support: [A, M, C],
  profile: [C],
  documents: [C],
  notices: [C],
  ops: [A],
}

/** Which roles can create / edit in each area. */
export const AREA_WRITE: Record<Area, readonly AppRole[]> = {
  dashboard: [],
  portal: [],
  warehouses: [A],
  zones: [A, M],
  brigadeTypes: [A],
  slots: [A, M],
  clients: [A, M],
  bookings: [A, M, C],      // clients may request; managers decide
  gate: [A, M, S],
  receipts: [],             // created only by confirming a gate entry
  stock: [A, M, S],         // transfers; adjustments need canDecide
  dispatch: [A, M, S, C],   // requests (staff too); managers approve; staff pick and confirm
  challans: [],
  labels: [],
  scan: [],
  users: [A, M],
  hiring: [A, M],
  audit: [],
  rates: [A],               // accountants read and export only
  invoices: [A],
  payments: [A],
  ledger: [],
  billingReports: [],
  billingSettings: [A],
  coldChain: [],
  sensors: [A, M],          // staff read sensors; managers register and calibrate
  manualReading: [A, M, S],
  alerts: [A, M, S],        // staff acknowledge; managers and administrators resolve (checked by canDecide)
  alertRules: [A, M],
  coldReports: [],
  equipment: [A, M],        // staff update their maintenance tasks
  staff: [A, M],
  attendance: [A, M, S],    // everyone checks in; managers approve (checked by canDecide)
  imports: [A],
  support: [A, M, C],
  profile: [C],
  documents: [],
  notices: [],
  ops: [A],
}

export function canAccess(role: AppRole | null | undefined, area: Area): boolean {
  return !!role && AREA_ACCESS[area].includes(role)
}

export function canWrite(role: AppRole | null | undefined, area: Area): boolean {
  return !!role && AREA_WRITE[area].includes(role)
}

/** Approve / reject / cancel documents and adjust stock: managers and administrators only. */
export function canDecide(role: AppRole | null | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'WAREHOUSE_MANAGER'
}

/** Pick, receive, dispatch: anyone working in a warehouse. */
export function canOperate(role: AppRole | null | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'WAREHOUSE_MANAGER' || role === 'STAFF'
}

/** Roles a given user may create through the create-user Edge Function. */
export function creatableRoles(role: AppRole | null | undefined): AppRole[] {
  if (role === 'SUPER_ADMIN') return ['WAREHOUSE_MANAGER', 'STAFF', 'ACCOUNTANT']
  if (role === 'WAREHOUSE_MANAGER') return ['STAFF']
  return []
}

export const NAV_ITEMS: { area: Area; path: string; labelKey: string }[] = [
  { area: 'dashboard', path: '/', labelKey: 'nav.dashboard' },
  { area: 'portal', path: '/', labelKey: 'nav.home' },
  { area: 'warehouses', path: '/warehouses', labelKey: 'nav.warehouses' },
  { area: 'zones', path: '/zones', labelKey: 'nav.zones' },
  { area: 'brigadeTypes', path: '/brigade-types', labelKey: 'nav.brigadeTypes' },
  { area: 'slots', path: '/slots', labelKey: 'nav.slots' },
  { area: 'clients', path: '/clients', labelKey: 'nav.clients' },
  { area: 'bookings', path: '/bookings', labelKey: 'nav.bookings' },
  { area: 'gate', path: '/gate', labelKey: 'nav.gate' },
  { area: 'receipts', path: '/receipts', labelKey: 'nav.receipts' },
  { area: 'stock', path: '/stock', labelKey: 'nav.stock' },
  { area: 'dispatch', path: '/dispatch', labelKey: 'nav.dispatch' },
  { area: 'challans', path: '/challans', labelKey: 'nav.challans' },
  { area: 'labels', path: '/labels', labelKey: 'nav.labels' },
  { area: 'scan', path: '/scan', labelKey: 'nav.scan' },
  { area: 'users', path: '/users', labelKey: 'nav.users' },
  { area: 'hiring', path: '/hiring', labelKey: 'nav.hiring' },
  { area: 'audit', path: '/audit', labelKey: 'nav.audit' },
  { area: 'invoices', path: '/invoices', labelKey: 'nav.invoices' },
  { area: 'payments', path: '/payments', labelKey: 'nav.payments' },
  { area: 'ledger', path: '/ledger', labelKey: 'nav.ledger' },
  { area: 'rates', path: '/rates', labelKey: 'nav.rates' },
  { area: 'billingReports', path: '/billing-reports', labelKey: 'nav.billingReports' },
  { area: 'billingSettings', path: '/billing-settings', labelKey: 'nav.billingSettings' },
  { area: 'coldChain', path: '/cold-chain', labelKey: 'nav.coldChain' },
  { area: 'manualReading', path: '/manual-reading', labelKey: 'nav.manualReading' },
  { area: 'alerts', path: '/alerts', labelKey: 'nav.alerts' },
  { area: 'sensors', path: '/sensors', labelKey: 'nav.sensors' },
  { area: 'alertRules', path: '/alert-rules', labelKey: 'nav.alertRules' },
  { area: 'equipment', path: '/equipment', labelKey: 'nav.equipment' },
  { area: 'coldReports', path: '/cold-reports', labelKey: 'nav.coldReports' },
  { area: 'staff', path: '/staff', labelKey: 'nav.staff' },
  { area: 'attendance', path: '/attendance', labelKey: 'nav.attendance' },
  { area: 'documents', path: '/documents', labelKey: 'nav.documents' },
  { area: 'support', path: '/support', labelKey: 'nav.support' },
  { area: 'profile', path: '/profile', labelKey: 'nav.profile' },
  { area: 'notices', path: '/notices', labelKey: 'nav.notices' },
  { area: 'imports', path: '/import', labelKey: 'nav.imports' },
  { area: 'ops', path: '/admin', labelKey: 'nav.ops' },
]

export function navFor(role: AppRole | null | undefined) {
  return NAV_ITEMS.filter((i) => canAccess(role, i.area))
}
