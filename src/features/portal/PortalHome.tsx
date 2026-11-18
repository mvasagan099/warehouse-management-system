import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building, CalendarClock, FileSignature, FileText, LifeBuoy, Package, PackageCheck, Receipt, Snowflake } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Badge, Card, ErrorState, PageHeader } from '../../components/ui/misc'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { formatDate, formatNumber } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { CompaniesDialog } from '../clients/CompaniesDialog'
import { ContractsDialog } from '../clients/ContractsDialog'
import { useClients } from '../shared/queries'

interface Dash {
  brigades_held: number
  stock_by_band: { band: string; lines: number; quantity: number; weight_kg: number }[]
  expiring: { id: string; item: string; batch: string | null; expiry: string; quantity: number; unit: string }[]
  open_requests: { bookings: number; dispatch: number; tickets: number; changes: number }
  outstanding_paise: number
  recent_documents: { type: 'RECEIPT' | 'CHALLAN' | 'INVOICE'; id: string; no: string; date: string }[]
  active_alerts: { id: string; kind: string; severity: 'WARNING' | 'CRITICAL'; since: string; status: string }[]
}

function Tile({ to, icon, label, value, sub, tone }: { to: string; icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'alert' }) {
  return (
    <Link to={to} className={`block min-h-24 rounded-xl border p-4 shadow-sm transition-colors hover:border-brand-500 ${tone === 'alert' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </Link>
  )
}

const DOC_PATH = { RECEIPT: '/receipts', CHALLAN: '/challans', INVOICE: '/invoices' } as const

/** A client login's home: only their own numbers (the database limits every figure to their client). */
export function PortalHome() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const clients = useClients()
  const [showContracts, setShowContracts] = useState(false)
  const [showCompanies, setShowCompanies] = useState(false)
  const client = clients.data?.find((c) => c.id === profile?.client_id)
  const dash = useQuery({ queryKey: ['client_dashboard'], refetchInterval: 60_000, queryFn: async () => { const { data, error } = await supabase.rpc('client_dashboard', {}); if (error) throw error; return data as unknown as Dash } })
  if (clients.isPending || dash.isPending) return <FullPageSpinner />
  if (dash.error || !dash.data) return <ErrorState message={t('common.error')} onRetry={() => dash.refetch()} retryLabel={t('common.retry')} />
  const d = dash.data
  const open = d.open_requests
  const alerts = d.active_alerts ?? []
  return (
    <div>
      <PageHeader title={client?.company_name ?? t('nav.home')} subtitle={client ? `${client.code}${client.gstin ? ` · GSTIN ${client.gstin}` : ''}` : undefined}
        actions={client && (<>
          <Button variant="secondary" icon={<FileSignature className="h-4 w-4" />} onClick={() => setShowContracts(true)}>{t('contracts.title')}</Button>
          <Button variant="secondary" icon={<Building className="h-4 w-4" />} onClick={() => setShowCompanies(true)}>{t('companies.title')}</Button></>)} />

      {alerts.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4" role="alert" data-testid="portal-alerts">
          <div className="flex items-center gap-2 font-semibold text-red-800"><AlertTriangle className="h-5 w-5" />{t('portal.alertsTitle', { count: alerts.length })}</div>
          <ul className="mt-2 space-y-1 text-sm text-red-900">{alerts.map((a) => <li key={a.id}><Badge tone={a.severity === 'CRITICAL' ? 'red' : 'amber'}>{t(`cold.severity.${a.severity}`)}</Badge> {t(`cold.kind.${a.kind}`)} · {formatDate(a.since, lang)}</li>)}</ul>
          <Link to="/cold-reports" className="mt-2 inline-block text-sm font-medium underline">{t('portal.seeTempReport')}</Link>
        </div>)}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile to="/bookings" icon={<Snowflake className="h-4 w-4" />} label={t('portal.brigadesHeld')} value={formatNumber(d.brigades_held, lang)} />
        <Tile to="/bookings" icon={<CalendarClock className="h-4 w-4" />} label={t('portal.openBookings')} value={formatNumber(open.bookings, lang)} />
        <Tile to="/dispatch" icon={<PackageCheck className="h-4 w-4" />} label={t('portal.openDispatch')} value={formatNumber(open.dispatch, lang)} />
        <Tile to="/support" icon={<LifeBuoy className="h-4 w-4" />} label={t('portal.openTickets')} value={formatNumber(open.tickets, lang)} />
        <Tile to="/invoices" icon={<Receipt className="h-4 w-4" />} label={t('portal.amountDue')} value={formatINR(d.outstanding_paise)} tone={d.outstanding_paise > 0 ? undefined : undefined} />
        <Tile to="/profile" icon={<FileText className="h-4 w-4" />} label={t('portal.profileRequests')} value={formatNumber(open.changes, lang)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Package className="h-4 w-4" />{t('portal.stockByBand')}</h2>
          {d.stock_by_band.length === 0 ? <p className="text-sm text-slate-500">{t('portal.noStock')}</p> : (
            <ul className="divide-y divide-slate-100 text-sm" data-testid="stock-bands">{d.stock_by_band.map((b) => (
              <li key={b.band} className="flex items-center justify-between py-2"><Badge tone={b.band === 'DRY' ? 'amber' : 'cyan'}>{t(`storageType.${b.band}`)}</Badge>
                <span>{formatNumber(b.lines, lang)} {t('portal.lines')} · {formatNumber(b.weight_kg, lang, 0)} kg</span></li>))}</ul>)}
          <Link to="/stock" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">{t('portal.openStock')}</Link>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">{t('portal.expiring')}</h2>
          {d.expiring.length === 0 ? <p className="text-sm text-slate-500">{t('portal.noExpiring')}</p> : (
            <ul className="divide-y divide-slate-100 text-sm">{d.expiring.map((e) => <li key={e.id} className="flex justify-between gap-2 py-2"><span>{e.item}{e.batch ? ` · ${e.batch}` : ''}</span><span className="text-amber-700">{formatDate(e.expiry, lang)}</span></li>)}</ul>)}
        </Card>
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{t('portal.recentDocs')}</h2><Link to="/documents" className="text-sm font-medium text-brand-700 hover:underline">{t('portal.allDocs')}</Link></div>
          {d.recent_documents.length === 0 ? <p className="text-sm text-slate-500">{t('docs.none')}</p> : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">{d.recent_documents.map((r) => <li key={r.type + r.id}><Link to={DOC_PATH[r.type]} className="flex min-h-11 items-center justify-between rounded-lg px-3 hover:bg-slate-50"><span><Badge tone="blue">{t(`docs.kinds.${r.type}`)}</Badge> <span className="ml-1 font-medium">{r.no}</span></span><span className="text-slate-500">{formatDate(r.date, lang)}</span></Link></li>)}</ul>)}
        </Card>
      </div>
      <Card className="mt-4 p-4 text-sm text-slate-600">{t('portal.help')}</Card>
      {showContracts && client && <ContractsDialog clientId={client.id} clientName={client.company_name} canEdit={false} onClose={() => setShowContracts(false)} />}
      {showCompanies && client && <CompaniesDialog clientId={client.id} clientName={client.company_name} onClose={() => setShowCompanies(false)} />}
    </div>
  )
}
