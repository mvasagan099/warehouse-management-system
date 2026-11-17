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
