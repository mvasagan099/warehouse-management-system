import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, ClipboardList, Clock, Cpu, Package, ServerCrash, Truck, Users, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../../auth/AuthProvider'
import { Select } from '../../components/ui/Field'
import { Badge, Card, ErrorState } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { formatNumber } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { useWarehouses } from '../shared/queries'
import { useState } from 'react'

interface AdminDash {
  occupancy: { warehouse: string; zone: string; zone_name: string; slots: number; occupied: number; reserved: number }[]
  revenue: { rent_paise: number; labour_paise: number; other_paise: number }
  outstanding_paise: number
  top_clients: { client_id: string; name: string; taxable_paise: number }[]
  expiring: { lines: number; days: number }
  open_alerts: { total: number; critical: number }
  sensors_offline: number
  maintenance_due: number
  cron_warnings: { job: string; status: string | null; last_ok_at: string | null; error: string | null }[]
  no_manager: string[]
  pending_change_requests: number
}
interface ManagerDash {
  expected_lorries: { kind: 'INWARD' | 'OUTWARD'; client: string; ref: string }[]
  pending_receipts: number; pending_dispatches: number
  staff_on_shift: { user_id: string; name: string; check_in_at: string }[]
  open_alerts: { total: number; critical: number }
  tasks: number; pending_corrections: number; open_tickets: number
}

function Stat({ to, icon, label, value, sub, tone }: { to?: string; icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'red' | 'amber' }) {
  const body = (<><div className="flex items-center gap-2 text-xs font-medium text-slate-500">{icon}{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</>)
  const cls = `block min-h-24 rounded-xl border p-4 shadow-sm ${tone === 'red' ? 'border-red-300 bg-red-50' : tone === 'amber' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`
  return to ? <Link to={to} className={`${cls} hover:border-brand-500`}>{body}</Link> : <div className={cls}>{body}</div>
}

export function AdminDashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const q = useQuery({ queryKey: ['admin_dashboard'], refetchInterval: 60_000, queryFn: async () => { const { data, error } = await supabase.rpc('admin_dashboard'); if (error) throw error; return data as unknown as AdminDash } })
  if (q.isPending) return <div className="flex justify-center p-6"><Spinner /></div>
  if (q.error || !q.data) return <ErrorState message={t('common.error')} onRetry={() => q.refetch()} />
  const d = q.data
  const byWh = Object.values(d.occupancy.reduce<Record<string, { warehouse: string; slots: number; occupied: number }>>((a, z) => { const w = (a[z.warehouse] ??= { warehouse: z.warehouse, slots: 0, occupied: 0 }); w.slots += z.slots; w.occupied += z.occupied; return a }, {}))
  const total = d.revenue.rent_paise + d.revenue.labour_paise + d.revenue.other_paise
  return (
    <section className="mb-8 space-y-4" aria-label={t('dash.adminTitle')} data-testid="admin-dashboard">
      {(d.cron_warnings.length > 0 || d.no_manager.length > 0) && (
        <div className="space-y-2" role="alert">
          {d.cron_warnings.map((w) => <div key={w.job} className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"><ServerCrash className="mt-0.5 h-4 w-4 shrink-0" /><span><b>{w.job}</b>: {w.status === 'FAILED' ? t('dash.jobFailed', { error: w.error ?? '' }) : t('dash.jobStale')}</span></div>)}
          {d.no_manager.length > 0 && <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><Users className="mt-0.5 h-4 w-4 shrink-0" />{t('dash.noManager', { list: d.no_manager.join(', ') })} <Link to="/warehouses" className="font-medium underline">{t('dash.assign')}</Link></div>}
        </div>)}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat to="/billing-reports" icon={<Package className="h-4 w-4" />} label={t('dash.revenueMonth')} value={formatINR(total)} sub={`${t('dash.rent')} ${formatINR(d.revenue.rent_paise)} · ${t('dash.labour')} ${formatINR(d.revenue.labour_paise)}`} />
        <Stat to="/ledger" icon={<ClipboardList className="h-4 w-4" />} label={t('dash.outstanding')} value={formatINR(d.outstanding_paise)} />
        <Stat to="/stock" icon={<CalendarClock className="h-4 w-4" />} label={t('dash.expiring')} value={formatNumber(d.expiring.lines, lang)} sub={t('dash.withinDays', { days: d.expiring.days })} tone={d.expiring.lines > 0 ? 'amber' : undefined} />
        <Stat to="/alerts" icon={<AlertTriangle className="h-4 w-4" />} label={t('dash.openAlerts')} value={formatNumber(d.open_alerts.total, lang)} sub={d.open_alerts.critical ? t('dash.critical', { count: d.open_alerts.critical }) : undefined} tone={d.open_alerts.critical ? 'red' : undefined} />
        <Stat to="/sensors" icon={<Cpu className="h-4 w-4" />} label={t('dash.sensorsOffline')} value={formatNumber(d.sensors_offline, lang)} tone={d.sensors_offline ? 'amber' : undefined} />
        <Stat to="/equipment" icon={<Wrench className="h-4 w-4" />} label={t('dash.maintenance')} value={formatNumber(d.maintenance_due, lang)} sub={t('dash.next14')} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><h2 className="mb-3 font-semibold">{t('dash.occupancyByWarehouse')}</h2>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={byWh}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="warehouse" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="occupied" stackId="a" fill="#0e7490" name={t('dash.occupied')} /><Bar dataKey="slots" fill="#cbd5e1" name={t('dash.slots')} /></BarChart></ResponsiveContainer></div></Card>
        <Card className="p-4"><h2 className="mb-3 font-semibold">{t('dash.occupancyByZone')}</h2>
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">{d.occupancy.map((z) => <li key={z.warehouse + z.zone} className="flex justify-between gap-2 py-1.5"><span>{z.warehouse} · {z.zone} {z.zone_name}</span><span className="text-slate-600">{z.occupied}/{z.slots} ({z.slots ? Math.round((z.occupied * 100) / z.slots) : 0}%)</span></li>)}</ul></Card>
        <Card className="p-4"><h2 className="mb-3 font-semibold">{t('dash.topClients')}</h2>
          <ul className="divide-y divide-slate-100 text-sm">{d.top_clients.map((c) => <li key={c.client_id} className="flex justify-between gap-2 py-1.5"><span>{c.name}</span><span className="font-medium">{formatINR(c.taxable_paise)}</span></li>)}{!d.top_clients.length && <li className="py-2 text-slate-500">{t('dash.noInvoices')}</li>}</ul></Card>
        <Card className="p-4"><h2 className="mb-3 font-semibold">{t('dash.revenueSplit')}</h2>
          <div className="space-y-2 text-sm">{([['rent', d.revenue.rent_paise], ['labour', d.revenue.labour_paise], ['other', d.revenue.other_paise]] as const).map(([k, v]) => (
            <div key={k}><div className="flex justify-between"><span>{t(`dash.${k}`)}</span><span>{formatINR(v)}</span></div><div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-700" style={{ width: `${total ? Math.round((v * 100) / total) : 0}%` }} /></div></div>))}</div>
          {d.pending_change_requests > 0 && <p className="mt-3 text-sm"><Badge tone="amber">{d.pending_change_requests}</Badge> {t('dash.changeRequests')}</p>}</Card>
      </div>
    </section>
  )
}

export function ManagerDashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const whs = useWarehouses()
  const [sel, setSel] = useState('')
  const mine = (whs.data ?? []).filter((w) => w.is_active)
  const warehouseId = sel || mine[0]?.id || ''
  const q = useQuery({ queryKey: ['manager_dashboard', warehouseId], enabled: !!warehouseId, refetchInterval: 60_000, queryFn: async () => { const { data, error } = await supabase.rpc('manager_dashboard', { p_warehouse_id: warehouseId }); if (error) throw error; return data as unknown as ManagerDash } })
  if (!profile) return null
  return (
    <section className="mb-8 space-y-4" aria-label={t('dash.managerTitle')} data-testid="manager-dashboard">
      {mine.length > 1 && <Select aria-label={t('common.warehouse')} value={warehouseId} onChange={(e) => setSel(e.target.value)} className="sm:w-64">{mine.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select>}
      {q.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : q.error || !q.data ? <ErrorState message={t('common.error')} onRetry={() => q.refetch()} /> : (<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat to="/gate" icon={<Truck className="h-4 w-4" />} label={t('dash.lorriesToday')} value={formatNumber(q.data.expected_lorries.length, lang)} />
          <Stat to="/gate" icon={<Package className="h-4 w-4" />} label={t('dash.pendingReceipts')} value={formatNumber(q.data.pending_receipts, lang)} />
          <Stat to="/dispatch" icon={<Truck className="h-4 w-4" />} label={t('dash.pendingDispatches')} value={formatNumber(q.data.pending_dispatches, lang)} />
          <Stat to="/attendance" icon={<Clock className="h-4 w-4" />} label={t('dash.onShift')} value={formatNumber(q.data.staff_on_shift.length, lang)} sub={q.data.pending_corrections ? t('dash.corrections', { count: q.data.pending_corrections }) : undefined} />
          <Stat to="/alerts" icon={<AlertTriangle className="h-4 w-4" />} label={t('dash.openAlerts')} value={formatNumber(q.data.open_alerts.total, lang)} tone={q.data.open_alerts.critical ? 'red' : undefined} />
          <Stat to="/equipment" icon={<Wrench className="h-4 w-4" />} label={t('dash.tasks')} value={formatNumber(q.data.tasks, lang)} sub={q.data.open_tickets ? t('dash.tickets', { count: q.data.open_tickets }) : undefined} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4"><h2 className="mb-3 font-semibold">{t('dash.expectedLorries')}</h2>
            <ul className="divide-y divide-slate-100 text-sm">{q.data.expected_lorries.map((l, i) => <li key={i} className="flex items-center justify-between py-1.5"><span><Badge tone={l.kind === 'INWARD' ? 'green' : 'violet'}>{t(`gateDirection.${l.kind}`)}</Badge> {l.client}</span><span className="font-mono text-xs text-slate-500">{l.ref}</span></li>)}{!q.data.expected_lorries.length && <li className="py-2 text-slate-500">{t('dash.noLorries')}</li>}</ul></Card>
          <Card className="p-4"><h2 className="mb-3 font-semibold">{t('dash.staffOnShift')}</h2>
            <ul className="divide-y divide-slate-100 text-sm">{q.data.staff_on_shift.map((s) => <li key={s.user_id} className="flex justify-between py-1.5"><span>{s.name}</span><span className="text-slate-500">{new Date(s.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span></li>)}{!q.data.staff_on_shift.length && <li className="py-2 text-slate-500">{t('dash.nobody')}</li>}</ul></Card>
        </div></>)}
    </section>
  )
}
