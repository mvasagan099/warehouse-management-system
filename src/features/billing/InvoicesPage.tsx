import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, FilePlus2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import type { BillingMode, Invoice } from '../../lib/types'
import { useClients, useWarehouses } from '../shared/queries'
import { STATUS_TONE, owed } from './common'
import { PaymentDialog, refreshBilling } from './InvoiceDialogs'
import { InvoiceDetail } from './InvoiceDetail'
import { useInvoices } from './queries'

const iso = (d: Date) => d.toISOString().slice(0, 10)
function lastFullMonth(): [string, string] {
  const now = new Date(Date.now() + 5.5 * 3600_000)
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  return [iso(first), iso(last)]
}

function GenerateDialog({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const clients = useClients()
  const warehouses = useWarehouses()
  const [from0, to0] = lastFullMonth()
  const [clientId, setClientId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [from, setFrom] = useState(from0)
  const [to, setTo] = useState(to0)
  const [mode, setMode] = useState<BillingMode | ''>('')
  const client = clients.data?.find((c) => c.id === clientId)
  const gen = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('generate_invoice_draft', { p_client_id: clientId, p_warehouse_id: warehouseId, p_from: from, p_to: to, p_mode: (mode || client?.billing_mode || 'BOTH') as BillingMode })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => { toast.success(t('billing.draftCreated')); refreshBilling(qc); onDone(id) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('billing.generate')} onClose={onClose} footer={<>
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={gen.isPending} disabled={!clientId || !warehouseId || !from || !to || to < from} onClick={() => gen.mutate()}>{t('billing.createDraft')}</Button></>}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label={t('common.client')} htmlFor="gn-client" className="col-span-2"><Select id="gn-client" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">{t('common.select')}</option>{(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</Select></Field>
        <Field label={t('common.warehouse')} htmlFor="gn-wh" className="col-span-2"><Select id="gn-wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="">{t('common.select')}</option>{(warehouses.data ?? []).filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select></Field>
        <Field label={t('billing.periodFrom')} htmlFor="gn-from"><Input id="gn-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t('billing.periodTo')} htmlFor="gn-to"><Input id="gn-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label={t('billing.mode')} htmlFor="gn-mode" className="col-span-2" hint={t('billing.modeHelp')}>
          <Select id="gn-mode" value={mode} onChange={(e) => setMode(e.target.value as BillingMode | '')}>
            <option value="">{t('billing.clientDefault')}{client ? ` (${t(`billingMode.${client.billing_mode}`)})` : ''}</option>
            {(['BOTH', 'RENT_ONLY', 'LABOUR_ONLY'] as const).map((m) => <option key={m} value={m}>{t(`billingMode.${m}`)}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

export function InvoicesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const admin = canWrite(profile?.role, 'invoices')
  const isClient = profile?.role === 'CLIENT'
  const [params, setParams] = useSearchParams()
  const list = useInvoices()
  const clients = useClients()
  const warehouses = useWarehouses()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [generating, setGenerating] = useState(false)
  const [paying, setPaying] = useState(false)
  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const whName = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, w.code])), [warehouses.data])
  const rows = useMemo(() => (list.data ?? []).filter((i) => !status || i.status === status), [list.data, status])
  const openId = params.get('id')

  const columns = useMemo<ColumnDef<Invoice>[]>(() => [
    { id: 'no', header: t('billing.invoiceNo'), accessorFn: (r) => r.invoice_no ?? t('billing.draftInvoice'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    ...(!isClient ? [{ id: 'client', header: t('common.client'), accessorFn: (r: Invoice) => clientName.get(r.client_id) ?? '' } satisfies ColumnDef<Invoice>] : []),
    { id: 'wh', header: t('common.warehouse'), accessorFn: (r) => whName.get(r.warehouse_id) ?? '' },
    { id: 'period', header: t('billing.period'), accessorFn: (r) => `${r.period_from} – ${r.period_to}`, cell: (c) => `${formatDate(c.row.original.period_from, lang)} – ${formatDate(c.row.original.period_to, lang)}` },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={STATUS_TONE[c.row.original.status]}>{t(`invoiceStatus.${c.row.original.status}`)}</Badge> },
    { accessorKey: 'grand_total_paise', header: t('billing.grandTotal'), cell: (c) => <span className="block text-right">{formatINR(c.getValue<number>())}</span> },
    { id: 'owed', header: t('billing.outstanding'), accessorFn: (r) => owed(r), cell: (c) => <span className="block text-right">{c.row.original.status === 'DRAFT' ? '—' : formatINR(c.getValue<number>())}</span> },
    { accessorKey: 'due_date', header: t('billing.dueDate'), cell: (c) => formatDate(c.getValue<string | null>(), lang) },
    { id: 'open', header: '', cell: ({ row }) => <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setParams({ id: row.original.id })}>{t('common.view')}</Button> },
  ], [t, lang, isClient, clientName, whName, setParams])

  return (
    <div>
      <PageHeader title={t('billing.invoices')} actions={admin && <>
        <Button variant="secondary" icon={<Wallet className="h-4 w-4" />} onClick={() => setPaying(true)}>{t('billing.recordPayment')}</Button>
        <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setGenerating(true)}>{t('billing.generate')}</Button></>} />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} aria-label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" />
          <Select aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
            <option value="">{t('common.all')}</option>
            {(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const).map((s) => <option key={s} value={s}>{t(`invoiceStatus.${s}`)}</option>)}
          </Select>
        </Toolbar>
        <DataTable data={rows} columns={columns} loading={list.isPending} error={list.error ? t('common.error') : null} onRetry={() => list.refetch()} search={search} filtered={!!status} emptyMessage={t('billing.noInvoices')} />
      </Card>
      {generating && <GenerateDialog onClose={() => setGenerating(false)} onDone={(id) => { setGenerating(false); setParams({ id }) }} />}
      {paying && <PaymentDialog onClose={() => setPaying(false)} />}
      {openId && <InvoiceDetail id={openId} onClose={() => setParams({})} />}
    </div>
  )
}
