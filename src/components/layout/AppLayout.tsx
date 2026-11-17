import clsx from 'clsx'
import {
  BarChart3, BookOpen, Boxes, Building2, CalendarClock, ClipboardCheck, ClipboardList, FileText, Grid3x3, KeyRound, LayoutDashboard,
  LogOut, Menu, PackageCheck, Package, Percent, QrCode, Receipt, Ruler, ScanLine, Settings, Snowflake, Truck, UserPlus, Users, Wallet, Warehouse, X,
} from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { navFor, type Area } from '../../auth/roles'
import { LanguageSwitch } from './LanguageSwitch'

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
}

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const items = navFor(profile?.role)

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
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
      {items.map((item) => {
        const Icon = ICONS[item.area]
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {t(item.labelKey)}
          </NavLink>
        )
      })}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-2 px-5 py-5 text-white">
      <Snowflake className="h-6 w-6 text-brand-500" aria-hidden />
      <span className="font-semibold leading-tight">{t('app.name')}</span>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 lg:flex">
        {brand}
        {nav}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-slate-900">
            <button className="absolute right-3 top-4 text-slate-300" onClick={() => setOpen(false)} aria-label={t('common.close')}>
              <X className="h-5 w-5" />
            </button>
            {brand}
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label={t('header.menu')}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <LanguageSwitch userId={profile?.id} />
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">{profile?.full_name || profile?.email}</div>
            <div className="text-xs text-slate-500">{profile ? t(`roles.${profile.role}`) : ''}</div>
          </div>
          <Link to="/account/password" className="rounded p-1.5 text-slate-600 hover:bg-slate-100" title={t('header.changePassword')} aria-label={t('header.changePassword')}>
            <KeyRound className="h-5 w-5" />
          </Link>
          <button onClick={() => signOut()} className="rounded p-1.5 text-slate-600 hover:bg-slate-100" title={t('header.logout')} aria-label={t('header.logout')}>
            <LogOut className="h-5 w-5" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
