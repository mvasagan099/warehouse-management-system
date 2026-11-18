import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, Check, PackageCheck, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canDecide, canOperate } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ReasonDialog } from '../../components/ui/ReasonDialog'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type DispatchRequest, type DispatchStatus } from '../../lib/types'
import { useClients, useCompanies, useWarehouses } from '../shared/queries'
import { QuickCompany } from '../gate/QuickAdd'
import { dispatchSchema, stockChoices, type DispatchFormInput, type DispatchFormOutput } from './schema'

export const DISPATCH_TONE: Record<DispatchStatus, 'amber' | 'green' | 'red' | 'gray' | 'blue' | 'violet'> = {
  REQUESTED: 'amber', APPROVED: 'green', REJECTED: 'red', PICKING: 'blue', DISPATCHED: 'violet', CANCELLED: 'gray',
}

interface LineDraft { key: string; choice: string; batch: string; quantity: string }

function RequestForm({ initial, lockClient, saving, onClose, onSubmit }: {
  initial: DispatchFormInput; lockClient: boolean; saving: boolean; onClose: () => void
  onSubmit: (v: DispatchFormOutput, lines: { item_name: string; sku: string | null; unit: string; batch_no: string | null; quantity: number }[]) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const clients = useClients()
  const warehouses = useWarehouses()
  const [drafts, setDrafts] = useState<LineDraft[]>([{ key: crypto.randomUUID(), choice: '', batch: '', quantity: '' }])
  const [lineError, setLineError] = useState<string | null>(null)
  const [addingCompany, setAddingCompany] = useState(false)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<DispatchFormInput, unknown, DispatchFormOutput>({
    resolver: zodResolver(dispatchSchema), defaultValues: initial,
  })
  const clientId = watch('client_id')
  const warehouseId = watch('warehouse_id')
  const companies = useCompanies(clientId || '')

  const stock = useQuery({
    queryKey: ['dispatch_stock', clientId, warehouseId],
    enabled: !!clientId && !!warehouseId,
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_items').select('item_name, sku, unit, quantity, batch_no')
        .eq('client_id', clientId).eq('warehouse_id', warehouseId).eq('condition', 'GOOD').gt('quantity', 0).is('deleted_at', null)
      if (error) throw error
      return data
    },
  })
  const choices = useMemo(() => stockChoices(stock.data ?? []), [stock.data])

  const submit = handleSubmit((v) => {
    const out: { item_name: string; sku: string | null; unit: string; batch_no: string | null; quantity: number }[] = []
    for (const d of drafts) {
      const c = choices.find((x) => x.key === d.choice)
      const qty = Number(d.quantity)
      if (!c || !(qty > 0)) { setLineError(t('dispatch.lineIncomplete')); return }
      if (qty > c.available) { setLineError(t('dispatch.exceeds', { item: c.item_name, available: c.available })); return }
      out.push({ item_name: c.item_name, sku: c.sku, unit: c.unit, batch_no: d.batch || null, quantity: qty })
    }
    setLineError(null)
    onSubmit(v, out)
  })

  return (
    <Modal open size="lg" title={t('dispatch.add')} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="dispatch-form" loading={saving}>{t('dispatch.submit')}</Button>
      </>
    }>
      {addingCompany && clientId && <QuickCompany clientId={clientId} onClose={() => setAddingCompany(false)} onCreated={(id) => { setValue('to_company_id', id, { shouldValidate: true }); setAddingCompany(false) }} />}
      <form id="dispatch-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.client')} htmlFor="dr-client" error={errors.client_id?.message}>
            <Select id="dr-client" disabled={lockClient} {...register('client_id')}>
              <option value="">{t('common.select')}</option>
              {clients.data?.filter((c) => c.status === 'ACTIVE').map((c) => <option key={c.id} value={c.id}>{c.code} · {c.company_name}</option>)}
            </Select>
          </Field>
          <Field label={t('common.warehouse')} htmlFor="dr-wh" error={errors.warehouse_id?.message}>
            <Select id="dr-wh" {...register('warehouse_id')}>
              <option value="">{t('common.select')}</option>
              {warehouses.data?.filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
            </Select>
          </Field>
          <Field label={t('gate.toCompany')} htmlFor="dr-company" error={errors.to_company_id?.message}>
            <Select id="dr-company" {...register('to_company_id')}>
              <option value="">{t('common.select')}</option>
              {companies.data?.filter((c) => c.kind !== 'SENDER').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {clientId ? <button type="button" className="mt-1 text-sm font-medium text-brand-700 hover:underline" onClick={() => setAddingCompany(true)}>+ {t('gate.newCompany')}</button>
              : <p className="mt-1 text-xs text-slate-500">{t('dispatch.pickClientFirst')}</p>}
          </Field>
          <Field label={t('dispatch.requestedDate')} htmlFor="dr-date" error={errors.requested_date?.message}>
            <Input id="dr-date" type="date" {...register('requested_date')} />
          </Field>
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold">{t('dispatch.items')}</legend>
          {!clientId || !warehouseId ? <p className="text-sm text-slate-500">{t('dispatch.pickClientFirst')}</p> : stock.isPending ? <p className="text-sm text-slate-500">{t('common.loading')}</p> : choices.length === 0 ? <p className="text-sm text-amber-700">{t('dispatch.noStock')}</p> : (
            <div className="space-y-2">
              {drafts.map((d, i) => {
                const c = choices.find((x) => x.key === d.choice)
                return (
                  <div key={d.key} className="grid grid-cols-[1fr_9rem_7rem_auto] items-center gap-2">
                    <Select aria-label={`${t('common.item')} ${i + 1}`} value={d.choice} onChange={(e) => setDrafts((ds) => ds.map((x) => x.key === d.key ? { ...x, choice: e.target.value, batch: '' } : x))}>
                      <option value="">{t('common.select')}</option>
                      {choices.map((x) => <option key={x.key} value={x.key}>{x.item_name}{x.sku ? ` (${x.sku})` : ''} — {formatNumber(x.available, lang, 3)} {x.unit}</option>)}
                    </Select>
                    <Select aria-label={`${t('common.batch')} ${i + 1}`} value={d.batch} onChange={(e) => setDrafts((ds) => ds.map((x) => x.key === d.key ? { ...x, batch: e.target.value } : x))} disabled={!c?.batches.length}>
                      <option value="">{t('dispatch.autoBatch')}</option>
                      {c?.batches.map((b) => <option key={b} value={b}>{b}</option>)}
                    </Select>
                    <Input aria-label={`${t('common.quantity')} ${i + 1}`} placeholder={t('common.quantity')} inputMode="decimal" value={d.quantity} onChange={(e) => setDrafts((ds) => ds.map((x) => x.key === d.key ? { ...x, quantity: e.target.value } : x))} />
                    <Button variant="ghost" size="sm" aria-label={t('common.remove')} disabled={drafts.length === 1} icon={<Trash2 className="h-4 w-4" />} onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))} />
                  </div>
                )
              })}
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setDrafts((ds) => [...ds, { key: crypto.randomUUID(), choice: '', batch: '', quantity: '' }])}>{t('dispatch.addItem')}</Button>
            </div>
          )}
          {lineError && <p className="mt-2 text-sm text-red-600" role="alert">{lineError}</p>}
        </fieldset>
        <Field label={t('common.notes')} htmlFor="dr-remarks" optional><Textarea id="dr-remarks" {...register('remarks')} /></Field>
      </form>
    </Modal>
  )
}

export function DispatchPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const decide = canDecide(profile?.role)
  const operate = canOperate(profile?.role)
  const qc = useQueryClient()
  const clients = useClients()
  const warehouses = useWarehouses()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [rejecting, setRejecting] = useState<DispatchRequest | null>(null)
  const [cancelling, setCancelling] = useState<DispatchRequest | null>(null)

  const list = useQuery({
    queryKey: ['dispatch_requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dispatch_requests').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      return data
    },
  })
  const refresh = () => { for (const k of ['dispatch_requests', 'dispatch', 'stock']) void qc.invalidateQueries({ queryKey: [k] }) }
  const fail = async (e: unknown) => toast.error(await errorMessage(e))

  const create = useMutation({
    mutationFn: async ({ v, lines }: { v: DispatchFormOutput; lines: { item_name: string; sku: string | null; unit: string; batch_no: string | null; quantity: number }[] }) => {
      const { data: req, error } = await supabase.from('dispatch_requests').insert(v).select('id, warehouse_id, client_id').single()
      if (error) throw error
      const { error: lineErr } = await supabase.from('dispatch_request_lines').insert(
        lines.map((l, i) => ({ ...l, request_id: req.id, warehouse_id: req.warehouse_id, client_id: req.client_id, line_no: i + 1 })),
      )
      if (lineErr) {
        await supabase.rpc('cancel_dispatch_request', { p_request_id: req.id, p_reason: 'Could not save the request lines' })
        throw lineErr
      }
    },
    onSuccess: () => { toast.success(t('dispatch.requested')); setCreating(false); refresh() },
    onError: fail,
  })
  const approve = useMutation({
    mutationFn: async (r: DispatchRequest) => { const { data, error } = await supabase.rpc('approve_dispatch_request', { p_request_id: r.id }); if (error) throw error; return data },
    onSuccess: (n) => { toast.success(t('dispatch.approvedN', { count: n })); refresh() },
    onError: fail,
  })
  const reject = useMutation({
    mutationFn: async ({ r, reason }: { r: DispatchRequest; reason: string }) => { const { error } = await supabase.rpc('reject_dispatch_request', { p_request_id: r.id, p_note: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('dispatch.rejected')); setRejecting(null); refresh() },
    onError: fail,
  })
  const cancel = useMutation({
    mutationFn: async ({ r, reason }: { r: DispatchRequest; reason: string }) => { const { error } = await supabase.rpc('cancel_dispatch_request', { p_request_id: r.id, p_reason: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('dispatch.cancelled')); setCancelling(null); refresh() },
    onError: fail,
  })

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const whName = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, w.code])), [warehouses.data])
  const rows = useMemo(() => (list.data ?? []).filter((r) => !status || r.status === status), [list.data, status])

  const columns = useMemo<ColumnDef<DispatchRequest>[]>(() => [
    { accessorKey: 'request_no', header: t('dispatch.no'), cell: (c) => <Link to={`/dispatch/${c.row.original.id}`} className="font-mono text-xs text-brand-700 hover:underline">{c.getValue<string | null>()}</Link> },
    ...(!isClient ? [{ id: 'client', header: t('common.client'), accessorFn: (r: DispatchRequest) => clientName.get(r.client_id) ?? '' } satisfies ColumnDef<DispatchRequest>] : []),
    { id: 'wh', header: t('common.warehouse'), accessorFn: (r) => whName.get(r.warehouse_id) ?? '' },
    { accessorKey: 'requested_date', header: t('dispatch.requestedDate'), cell: (c) => formatDate(c.getValue<string>(), lang) },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={DISPATCH_TONE[c.getValue<DispatchStatus>()]}>{t(`dispatchStatus.${c.getValue<string>()}`)}</Badge> },
    {
      id: 'actions', header: t('common.actions'),
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex gap-1">
            {decide && r.status === 'REQUESTED' && (
              <>
                <Button size="sm" icon={<Check className="h-4 w-4" />} loading={approve.isPending && approve.variables?.id === r.id} onClick={() => approve.mutate(r)}>{t('common.approve')}</Button>
                <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => setRejecting(r)}>{t('common.reject')}</Button>
              </>
            )}
            {operate && (r.status === 'APPROVED' || r.status === 'PICKING') && (
              <Link to={`/dispatch/${r.id}`} className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"><PackageCheck className="h-4 w-4" />{t('dispatch.pickAndDispatch')}</Link>
            )}
            {((decide && ['REQUESTED', 'APPROVED', 'PICKING'].includes(r.status)) || (isClient && r.status === 'REQUESTED')) && (
              <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelling(r)}>{t('common.cancelDoc')}</Button>
            )}
          </div>
        )
      },
    },
  ], [t, lang, isClient, decide, operate, clientName, whName, approve])

  const active = (warehouses.data ?? []).filter((w) => w.is_active)
  const canCreate = decide || isClient || operate

  return (
    <div>
      <PageHeader title={t('dispatch.title')} subtitle={isClient ? t('dispatch.clientHelp') : undefined}
        actions={canCreate && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('dispatch.add')}</Button>} />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('common.search')} />
          <Select aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="">{t('common.all')}</option>
            {Constants.public.Enums.dispatch_status.map((s) => <option key={s} value={s}>{t(`dispatchStatus.${s}`)}</option>)}
          </Select>
        </Toolbar>
        <DataTable data={rows} columns={columns} loading={list.isPending || clients.isPending} error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()} search={search} filtered={!!status} emptyMessage={t('dispatch.empty')} />
      </Card>
      {creating && (
        <RequestForm
          initial={{ client_id: isClient ? (profile?.client_id ?? '') : '', warehouse_id: active.length === 1 ? active[0].id : '', to_company_id: '', requested_date: new Date().toISOString().slice(0, 10), remarks: '' }}
          lockClient={isClient}
          saving={create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(v, lines) => create.mutate({ v, lines })}
        />
      )}
      <ReasonDialog open={!!rejecting} title={t('dispatch.rejectTitle')} confirmLabel={t('common.reject')} loading={reject.isPending}
        onConfirm={(reason) => rejecting && reject.mutate({ r: rejecting, reason })} onClose={() => setRejecting(null)} />
      <ReasonDialog open={!!cancelling} title={t('dispatch.cancelTitle')} loading={cancel.isPending}
        onConfirm={(reason) => cancelling && cancel.mutate({ r: cancelling, reason })} onClose={() => setCancelling(null)} />
    </div>
  )
}
