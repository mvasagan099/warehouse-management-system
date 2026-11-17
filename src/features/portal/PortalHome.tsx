import { useQuery } from '@tanstack/react-query'
import { Building, CalendarClock, ClipboardCheck, FileSignature, FileText, Package, PackageCheck, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Card, ErrorState, PageHeader } from '../../components/ui/misc'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { formatNumber } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { CompaniesDialog } from '../clients/CompaniesDialog'
import { ContractsDialog } from '../clients/ContractsDialog'
import { useClients } from '../shared/queries'

function Tile({ to, icon, label, value, sub }: { to: string; icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Link to={to} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-500">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </Link>
  )
}

/** A client login's home: only their own numbers (the database already limits every query to their client). */
export function PortalHome() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const clients = useClients()
  const [showContracts, setShowContracts] = useState(false)
  const [showCompanies, setShowCompanies] = useState(false)
  const client = clients.data?.find((c) => c.id === profile?.client_id)

  const counts = useQuery({
    queryKey: ['portal_counts'],
    queryFn: async () => {
      const head = { count: 'exact' as const, head: true }
      const [stock, bookings, dispatch, receipts, challans, invoices] = await Promise.all([
        supabase.from('stock_items').select('quantity', { count: 'exact' }).gt('quantity', 0).is('deleted_at', null),
        supabase.from('space_bookings').select('id', head).eq('status', 'REQUESTED'),
        supabase.from('dispatch_requests').select('id', head).in('status', ['REQUESTED', 'APPROVED', 'PICKING']),
        supabase.from('inward_receipts').select('id', head).eq('status', 'CONFIRMED'),
        supabase.from('delivery_challans').select('id', head).eq('status', 'CONFIRMED'),
        supabase.from('invoices').select('grand_total_paise, paid_paise, credit_paise').in('status', ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE']),
      ])
      for (const r of [stock, bookings, dispatch, receipts, challans, invoices]) if (r.error) throw r.error
      return {
        stockLines: stock.count ?? 0,
        stockQty: (stock.data ?? []).reduce((n, r) => n + Number(r.quantity), 0),
        openBookings: bookings.count ?? 0, openDispatch: dispatch.count ?? 0, receipts: receipts.count ?? 0, challans: challans.count ?? 0,
        invoicesOpen: (invoices.data ?? []).length,
        owedPaise: (invoices.data ?? []).reduce((n, r) => n + r.grand_total_paise - r.paid_paise - r.credit_paise, 0),
      }
    },
  })

  if (clients.isPending || counts.isPending) return <FullPageSpinner />
  if (counts.error || !counts.data) return <ErrorState message={t('common.error')} onRetry={() => counts.refetch()} retryLabel={t('common.retry')} />
  const c = counts.data

  return (
    <div>
      <PageHeader title={client?.company_name ?? t('nav.home')} subtitle={client ? `${client.code}${client.gstin ? ` · GSTIN ${client.gstin}` : ''}` : undefined}
        actions={client && (
          <>
            <Button variant="secondary" icon={<FileSignature className="h-4 w-4" />} onClick={() => setShowContracts(true)}>{t('contracts.title')}</Button>
            <Button variant="secondary" icon={<Building className="h-4 w-4" />} onClick={() => setShowCompanies(true)}>{t('companies.title')}</Button>
          </>
        )} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile to="/stock" icon={<Package className="h-4 w-4" />} label={t('nav.stock')} value={formatNumber(c.stockLines, lang)} sub={t('portal.stockLines')} />
        <Tile to="/bookings" icon={<CalendarClock className="h-4 w-4" />} label={t('portal.openBookings')} value={formatNumber(c.openBookings, lang)} />
        <Tile to="/dispatch" icon={<PackageCheck className="h-4 w-4" />} label={t('portal.openDispatch')} value={formatNumber(c.openDispatch, lang)} />
        <Tile to="/receipts" icon={<ClipboardCheck className="h-4 w-4" />} label={t('nav.receipts')} value={formatNumber(c.receipts, lang)} />
        <Tile to="/challans" icon={<FileText className="h-4 w-4" />} label={t('nav.challans')} value={formatNumber(c.challans, lang)} />
        <Tile to="/invoices" icon={<Receipt className="h-4 w-4" />} label={t('portal.amountDue')} value={formatINR(c.owedPaise)} sub={t('portal.openInvoices', { count: c.invoicesOpen })} />
      </div>
      <Card className="p-4 text-sm text-slate-600">{t('portal.help')}</Card>
      {showContracts && client && <ContractsDialog clientId={client.id} clientName={client.company_name} canEdit={false} onClose={() => setShowContracts(false)} />}
      {showCompanies && client && <CompaniesDialog clientId={client.id} clientName={client.company_name} onClose={() => setShowCompanies(false)} />}
    </div>
  )
}
