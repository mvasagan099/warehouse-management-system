import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownToLine, ArrowUpFromLine, Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Input, Select } from '../../components/ui/Field'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type GateDirection, type GateEntry, type GateStatus } from '../../lib/types'
import { useClients, useWarehouses } from '../shared/queries'
import { GateEntryForm } from './GateEntryForm'
import { emptyGate, type GateFormOutput } from './schema'

export const GATE_TONE: Record<GateStatus, 'amber' | 'blue' | 'green' | 'violet' | 'gray' | 'red'> = {
  AT_GATE: 'amber', UNLOADING: 'blue', RECEIVED: 'green', LOADING: 'blue', DISPATCHED: 'violet', CANCELLED: 'red',
}

export function GatePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const navigate = useNavigate()
  const qc = useQueryClient()
  const clients = useClients()
  const warehouses = useWarehouses()
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('')
  const [status, setStatus] = useState('')
  const [form, setForm] = useState<GateDirection | null>(null)

  const list = useQuery({
    queryKey: ['gate_entries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gate_entries').select('*').is('deleted_at', null).order('gate_in_at', { ascending: false }).limit(500)
      if (error) throw error
      return data
    },
  })

  const create = useMutation({
    mutationFn: async (v: GateFormOutput) => {
      const { data, error } = await supabase.from('gate_entries').insert(v).select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: (id) => { toast.success(t('gate.recorded')); setForm(null); void qc.invalidateQueries({ queryKey: ['gate_entries'] }); navigate(`/gate/${id}`) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const active = (warehouses.data ?? []).filter((w) => w.is_active)
  const onlyWarehouse = active.length === 1 ? active[0].id : ''
  const rows = useMemo(() => (list.data ?? []).filter((g) => (!direction || g.direction === direction) && (!status || g.status === status)), [list.data, direction, status])

  const columns = useMemo<ColumnDef<GateEntry>[]>(() => [
    { accessorKey: 'gate_pass_no', header: t('gate.passNo'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string | null>()}</span> },
    {
      accessorKey: 'direction', header: t('gate.direction'),
      cell: (c) => c.getValue() === 'INWARD'
        ? <Badge tone="green"><ArrowDownToLine className="mr-1 h-3 w-3" />{t('gateDirection.INWARD')}</Badge>
        : <Badge tone="violet"><ArrowUpFromLine className="mr-1 h-3 w-3" />{t('gateDirection.OUTWARD')}</Badge>,
    },
    { accessorKey: 'lorry_number', header: t('gate.lorryNumber'), cell: (c) => <span className="font-mono">{c.getValue<string>()}</span> },
    { id: 'client', header: t('common.client'), accessorFn: (g) => clientName.get(g.client_id) ?? '' },
    { accessorKey: 'driver_name', header: t('gate.driverName'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { accessorKey: 'gate_in_at', header: t('gate.gateIn'), cell: (c) => formatDateTime(c.getValue<string>(), lang) },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={GATE_TONE[c.getValue<GateStatus>()]}>{t(`gateStatus.${c.getValue<string>()}`)}</Badge> },
    { id: 'open', header: '', cell: ({ row }) => <Link to={`/gate/${row.original.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><Eye className="h-4 w-4" />{t('common.view')}</Link> },
  ], [t, lang, clientName])

  return (
    <div>
      <PageHeader
        title={t('gate.title')}
        actions={
          <>
            <Button className="h-11 text-base" icon={<ArrowDownToLine className="h-5 w-5" />} onClick={() => setForm('INWARD')}>{t('gate.addInward')}</Button>
            <Button className="h-11 text-base" variant="secondary" icon={<ArrowUpFromLine className="h-5 w-5" />} onClick={() => setForm('OUTWARD')}>{t('gate.addOutward')}</Button>
          </>
        }
      />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('common.search')} />
          <Select aria-label={t('gate.direction')} value={direction} onChange={(e) => setDirection(e.target.value)} className="sm:w-40">
            <option value="">{t('common.all')}</option>
            {Constants.public.Enums.gate_direction.map((d) => <option key={d} value={d}>{t(`gateDirection.${d}`)}</option>)}
          </Select>
          <Select aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="">{t('common.all')}</option>
            {Constants.public.Enums.gate_status.map((s) => <option key={s} value={s}>{t(`gateStatus.${s}`)}</option>)}
          </Select>
        </Toolbar>
        <DataTable data={rows} columns={columns} loading={list.isPending || clients.isPending} error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()} search={search} filtered={!!direction || !!status} emptyMessage={t('gate.empty')} />
      </Card>
      {form && <GateEntryForm initial={emptyGate(form, onlyWarehouse)} saving={create.isPending} onClose={() => setForm(null)} onSubmit={(v) => create.mutate(v)} />}
    </div>
  )
}
