import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { DataTable } from '../../components/ui/DataTable'
import { Input, Select } from '../../components/ui/Field'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { InwardReceipt } from '../../lib/types'
import { useClients, useWarehouses } from '../shared/queries'

/** Type a receipt number and see its status at once (received, cancelled, and where the lorry is). */
function ReceiptLookup() {
  const { t, i18n } = useTranslation()
  const [no, setNo] = useState('')
  const q = no.trim()
  const found = useQuery({
    queryKey: ['receipt_lookup', q], enabled: q.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.from('inward_receipts').select('*').ilike('receipt_no', `%${q.replace(/[%_]/g, '')}%`).limit(5)
      if (error) throw error
      const gates = data.length ? await supabase.from('gate_entries').select('id, lorry_number, status').in('id', data.map((r) => r.gate_entry_id)) : { data: [] }
      return data.map((r) => ({ r, gate: gates.data?.find((g) => g.id === r.gate_entry_id) }))
    },
  })
  return (
    <Card className="mb-4 p-4">
      <label htmlFor="rc-lookup" className="mb-1 block text-sm font-medium">{t('receipts.lookupTitle')}</label>
      <Input id="rc-lookup" value={no} onChange={(e) => setNo(e.target.value)} placeholder={t('receipts.lookupHint')} className="h-12 text-base sm:w-96" autoComplete="off" />
      {q.length >= 3 && found.data && (
        <ul className="mt-3 space-y-2" data-testid="lookup-results">
          {found.data.length === 0 && <li className="text-sm text-slate-500">{t('receipts.notFound')}</li>}
          {found.data.map(({ r, gate }) => (
            <li key={r.id}><Link to={`/receipts/${r.id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-brand-500">
              <span className="font-mono font-semibold">{r.receipt_no}</span><Badge tone={r.status === 'CONFIRMED' ? 'green' : 'red'}>{t(`docStatus.${r.status}`)}</Badge>
              <span className="text-sm text-slate-600">{formatDateTime(r.received_at, i18n.resolvedLanguage)}</span>{gate && <span className="text-sm text-slate-600">{t('receipts.lorry')} {gate.lorry_number} · {t(`gateStatus.${gate.status}`)}</span>}</Link></li>))}
        </ul>)}
    </Card>
  )
}

export function ReceiptsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const clients = useClients()
  const warehouses = useWarehouses()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const list = useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inward_receipts').select('*').is('deleted_at', null).order('received_at', { ascending: false }).limit(500)
      if (error) throw error
      return data
    },
  })
  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const whName = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, w.code])), [warehouses.data])
  const rows = useMemo(() => (list.data ?? []).filter((r) => !status || r.status === status), [list.data, status])

  const columns = useMemo<ColumnDef<InwardReceipt>[]>(() => [
    { accessorKey: 'receipt_no', header: t('receipts.no'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: 'received_at', header: t('receipts.receivedAt'), cell: (c) => formatDateTime(c.getValue<string>(), lang) },
    ...(!isClient ? [{ id: 'client', header: t('common.client'), accessorFn: (r: InwardReceipt) => clientName.get(r.client_id) ?? '' } satisfies ColumnDef<InwardReceipt>] : []),
    { id: 'wh', header: t('common.warehouse'), accessorFn: (r) => whName.get(r.warehouse_id) ?? '' },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={c.getValue() === 'CONFIRMED' ? 'green' : 'red'}>{t(`docStatus.${c.getValue<string>()}`)}</Badge> },
    { id: 'open', header: '', cell: ({ row }) => <Link to={`/receipts/${row.original.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><Eye className="h-4 w-4" />{t('common.view')}</Link> },
  ], [t, lang, isClient, clientName, whName])

  return (
    <div>
      <PageHeader title={t('receipts.title')} />
      <ReceiptLookup />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('common.search')} />
          <Select aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="">{t('common.all')}</option>
            <option value="CONFIRMED">{t('docStatus.CONFIRMED')}</option>
            <option value="CANCELLED">{t('docStatus.CANCELLED')}</option>
          </Select>
        </Toolbar>
        <DataTable data={rows} columns={columns} loading={list.isPending || clients.isPending} error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()} search={search} filtered={!!status} emptyMessage={t('receipts.empty')} />
      </Card>
    </div>
  )
}
