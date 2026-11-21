import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select } from '../../components/ui/Field'
import { Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { formatDate } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { useClients } from '../shared/queries'
import { downloadText, paiseToRupeeText, toCsv } from './common'

type LedgerRow = { entry_date: string; doc_type: string; doc_no: string; description: string; debit_paise: number; credit_paise: number; balance_paise: number; doc_id: string }

function RateSummary() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['my_rate_summary'], queryFn: async () => { const { data, error } = await supabase.rpc('my_rate_summary'); if (error) throw error; return data } })
  if (!q.data?.length) return null
  return (
    <Card className="mt-6">
      <div className="border-b border-slate-200 p-3 font-semibold">{t('billing.myRates')}</div>
      <table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2">{t('billing.rateFor')}</th><th className="px-3 py-2">{t('billing.detail')}</th><th className="px-3 py-2 text-right">{t('billing.rate')}</th><th className="px-3 py-2">{t('billing.basis')}</th></tr></thead>
        <tbody>{q.data.map((r, i) => <tr key={i}><td className="px-3 py-2">{r.label}</td><td className="px-3 py-2 text-slate-500">{r.detail}</td><td className="px-3 py-2 text-right">{formatINR(r.rate_paise)}</td><td className="px-3 py-2">{r.basis}</td></tr>)}</tbody></table>
    </Card>
  )
}

export function LedgerPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const clients = useClients()
  const [clientId, setClientId] = useState(isClient ? profile?.client_id ?? '' : '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  useEffect(() => { if (!clientId && clients.data?.length) setClientId(isClient ? clients.data[0].id : '') }, [clients.data, clientId, isClient])

  const ledger = useQuery({
    queryKey: ['ledger', clientId, from, to], enabled: !!clientId,
    queryFn: async () => { const { data, error } = await supabase.rpc('client_ledger', { p_client_id: clientId, p_from: from || undefined, p_to: to || undefined }); if (error) throw error; return data as LedgerRow[] },
  })
  const ageing = useQuery({
    queryKey: ['ageing'], enabled: !isClient,
    queryFn: async () => { const { data, error } = await supabase.rpc('ageing_report'); if (error) throw error; return data },
  })
  const name = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const columns = useMemo<ColumnDef<LedgerRow>[]>(() => [
    { accessorKey: 'entry_date', header: t('common.date'), cell: (c) => formatDate(c.getValue<string>(), lang) },
    { accessorKey: 'doc_type', header: t('billing.document'), cell: (c) => t(`billing.docType.${c.getValue<string>()}`) },
    { accessorKey: 'doc_no', header: t('billing.number'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: 'description', header: t('billing.description') },
    { accessorKey: 'debit_paise', header: t('billing.debit'), cell: (c) => <span className="block text-right">{c.getValue<number>() ? formatINR(c.getValue<number>()) : ''}</span> },
    { accessorKey: 'credit_paise', header: t('billing.credit'), cell: (c) => <span className="block text-right">{c.getValue<number>() ? formatINR(c.getValue<number>()) : ''}</span> },
    { accessorKey: 'balance_paise', header: t('billing.balance'), cell: (c) => <span className="block text-right font-medium">{formatINR(c.getValue<number>())}</span> },
  ], [t, lang])
  const exportCsv = () => downloadText(`ledger-${name.get(clientId) ?? 'client'}.csv`, toCsv(['Date', 'Type', 'Number', 'Description', 'Debit', 'Credit', 'Balance'],
    (ledger.data ?? []).map((r) => [r.entry_date, r.doc_type, r.doc_no, r.description, paiseToRupeeText(r.debit_paise), paiseToRupeeText(r.credit_paise), paiseToRupeeText(r.balance_paise)])))
  const sum = (k: 'b0_30' | 'b31_60' | 'b61_90' | 'b90_plus' | 'outstanding_paise' | 'advance_paise') => (ageing.data ?? []).reduce((a, r) => a + r[k], 0)

  return (
    <div>
      <PageHeader title={t('billing.ledger')} />
      <Card>
        <Toolbar>
          {!isClient && <Select aria-label={t('common.client')} className="sm:w-72" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">{t('billing.chooseClient')}</option>{(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</Select>}
          <Field label={t('billing.periodFrom')} htmlFor="lg-from" className="flex items-center gap-2 space-y-0"><Input id="lg-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></Field>
          <Field label={t('billing.periodTo')} htmlFor="lg-to" className="flex items-center gap-2 space-y-0"><Input id="lg-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></Field>
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} disabled={!ledger.data?.length} onClick={exportCsv}>CSV</Button>
        </Toolbar>
        {clientId ? <DataTable data={ledger.data} columns={columns} loading={ledger.isPending} error={ledger.error ? t('common.error') : null} onRetry={() => ledger.refetch()} pageSize={50} emptyMessage={t('billing.noLedger')} />
          : <p className="p-6 text-sm text-slate-500">{t('billing.chooseClient')}</p>}
      </Card>
      {isClient && <RateSummary />}
      {!isClient && (
        <Card className="mt-6">
          <div className="border-b border-slate-200 p-3 font-semibold">{t('billing.ageing')}</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm" data-testid="ageing">
              <thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2">{t('common.client')}</th><th className="px-3 py-2 text-right">0–30</th><th className="px-3 py-2 text-right">31–60</th><th className="px-3 py-2 text-right">61–90</th><th className="px-3 py-2 text-right">90+</th><th className="px-3 py-2 text-right">{t('billing.outstanding')}</th><th className="px-3 py-2 text-right">{t('billing.advance')}</th></tr></thead>
              <tbody>
                {(ageing.data ?? []).map((r) => <tr key={r.client_id}><td className="px-3 py-2"><Link className="text-brand-700 underline" to="#" onClick={(e) => { e.preventDefault(); setClientId(r.client_id) }}>{r.client_name}</Link></td>
                  {[r.b0_30, r.b31_60, r.b61_90, r.b90_plus, r.outstanding_paise, r.advance_paise].map((v, i) => <td key={i} className="px-3 py-2 text-right">{formatINR(v)}</td>)}</tr>)}
                <tr className="border-t border-slate-300 font-semibold"><td className="px-3 py-2">{t('billing.total')}</td>{(['b0_30', 'b31_60', 'b61_90', 'b90_plus', 'outstanding_paise', 'advance_paise'] as const).map((k) => <td key={k} className="px-3 py-2 text-right">{formatINR(sum(k))}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
