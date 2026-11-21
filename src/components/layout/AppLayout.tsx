import clsx from 'clsx'
import {
  Activity, AlertTriangle, BarChart3, BookOpen, Cpu, Thermometer, UserCog, CalendarCheck, FileUp, ServerCog, Download as DownloadIcon, Bell, UserCircle, Wrench, SlidersHorizontal, FileBarChart, Boxes, Building2, CalendarClock, ClipboardCheck, ClipboardList, FileText, Grid3x3, KeyRound, LayoutDashboard,
  LifeBuoy, LogOut, Menu, PackageCheck, Package, Percent, QrCode, Receipt, Ruler, ScanLine, Settings, Snowflake, Truck, UserPlus, Users, Wallet, Warehouse, X,
} from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { navFor, type Area } from '../../auth/roles'
import { LanguageSwitch } from './LanguageSwitch'
import { NotificationBell } from './NotificationBell'
import { SyncStatus } from './SyncStatus'
import { disabledAreas, useFeatureFlags } from '../../lib/features'

const ICONS: Record<Area, ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  warehouses: Warehouse,
  zones: Grid3x3,
  brigadeTypes: Ruler,
  slots: Boxes,
  users: Users,
  hiring: UserPlus,
  audit: ClipboardList,
  portal: LayoutDashboard,
  clients: Building2,
  bookings: CalendarClock,
  gate: Truck,
  receipts: ClipboardCheck,
  stock: Package,
  dispatch: PackageCheck,
  challans: FileText,
  labels: QrCode,
  scan: ScanLine,
  rates: Percent,
  invoices: Receipt,
  payments: Wallet,
  ledger: BookOpen,
  billingReports: BarChart3,
  billingSettings: Settings,
  coldChain: Activity,
  manualReading: Thermometer,
  alerts: AlertTriangle,
  sensors: Cpu,
  alertRules: SlidersHorizontal,
  equipment: Wrench,
  coldReports: FileBarChart,
  staff: UserCog,
  advice: Truck,
  companies: Building2,
  attendance: CalendarCheck,
  imports: FileUp,
  ops: ServerCog,
  support: LifeBuoy,
  profile: UserCircle,
  documents: DownloadIcon,
  notices: Bell,
}

const GROUPS: { key: string; areas: Area[] }[] = [
  { key: 'main', areas: ['dashboard', 'portal'] },
  { key: 'operations', areas: ['advice', 'bookings', 'gate', 'receipts', 'stock', 'dispatch', 'challans'] },
  { key: 'clients', areas: ['clients', 'companies', 'support', 'documents', 'profile', 'notices'] },
  { key: 'coldchain', areas: ['coldChain', 'manualReading', 'alerts', 'sensors', 'alertRules', 'equipment', 'coldReports'] },
  { key: 'billing', areas: ['invoices', 'payments', 'ledger', 'rates', 'billingReports', 'billingSettings'] },
  { key: 'people', areas: ['users', 'staff', 'hiring', 'attendance'] },
  { key: 'setup', areas: ['warehouses', 'zones', 'brigadeTypes', 'slots', 'labels', 'scan', 'imports', 'audit', 'ops'] },
]

/** The four links a phone needs most, shown in a bar at the bottom of the screen. */
const QUICK: Area[] = ['dashboard', 'portal', 'attendance', 'gate', 'receipts', 'dispatch', 'stock', 'advice', 'support', 'documents']

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const flags = useFeatureFlags()
  const off = disabledAreas(flags.data)
  const items = navFor(profile?.role).filter((i) => !off.has(i.area))
  const quick = items.filter((i) => QUICK.includes(i.area)).slice(0, 4)

  useEffect(() => setOpen(false), [location.pathname])

  // apply the language saved on the profile once, if the user never picked one on this device
  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem('wms.lang') } catch { /* private mode */ }
    if (!stored && profile?.preferred_language && profile.preferred_language !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(profile.preferred_language)
    }
  }, [profile?.preferred_language, i18n])

  const nav = (
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
      {GROUPS.map((g) => {
        const list = items.filter((i) => g.areas.includes(i.area))
        if (!list.length) return null
        return (
          <div key={g.key} className="mb-3">
            {g.key !== 'main' && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t(`nav.group.${g.key}`)}</div>}
            <div className="space-y-0.5">
              {list.map((item) => {
                const Icon = ICONS[item.area]
                return (
                  <NavLink key={item.path} to={item.path} end={item.path === '/'}
                    className={({ isActive }) => clsx('group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
                    {({ isActive }) => (<>
                      {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-brand-500" aria-hidden />}
                      <Icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-brand-500' : 'text-slate-400 group-hover:text-slate-200')} />
                      {t(item.labelKey)}
                    </>)}
                  </NavLink>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5 text-white">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-lg shadow-brand-700/40"><Snowflake className="h-5 w-5" aria-hidden /></span>
      <span className="font-semibold leading-tight tracking-tight">{t('app.name')}</span>
    </div>
  )

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* desktop sidebar */}
      <aside className="hidden h-full w-64 shrink-0 flex-col bg-gradient-to-b from-slate-900 to-slate-950 lg:flex">
        {brand}
        {nav}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
            <button className="absolute right-3 top-4 text-slate-300" onClick={() => setOpen(false)} aria-label={t('common.close')}>
              <X className="h-5 w-5" />
            </button>
            {brand}
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur">
          <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label={t('header.menu')}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <SyncStatus />
          <NotificationBell />
          <LanguageSwitch userId={profile?.id} />
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">{profile?.full_name || profile?.email}</div>
            <div className="text-xs text-slate-500">{profile ? t(`roles.${profile.role}`) : ''}</div>
          </div>
          <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 sm:flex" aria-hidden>{(profile?.full_name || profile?.email || '?').slice(0, 1).toUpperCase()}</span>
          <Link to="/account/password" className="rounded p-1.5 text-slate-600 hover:bg-slate-100" title={t('header.changePassword')} aria-label={t('header.changePassword')}>
            <KeyRound className="h-5 w-5" />
          </Link>
          <button onClick={() => signOut()} className="rounded p-1.5 text-slate-600 hover:bg-slate-100" title={t('header.logout')} aria-label={t('header.logout')}>
            <LogOut className="h-5 w-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:pb-6">
          <div className="mx-auto w-full max-w-7xl"><Outlet /></div>
        </main>
        {quick.length > 0 && (
          <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${quick.length}, minmax(0, 1fr))` }} aria-label={t('header.quick')}>
            {quick.map((item) => { const Icon = ICONS[item.area]; return (
              <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => clsx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}>
                <Icon className="h-5 w-5" />{t(item.labelKey)}</NavLink>) })}
          </nav>)}
      </div>
    </div>
  )
}
