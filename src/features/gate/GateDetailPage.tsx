import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, ClipboardCheck, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canDecide } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { PhotoUpload } from '../../components/ui/PhotoUpload'
import { ReasonDialog } from '../../components/ui/ReasonDialog'
import { Badge, Card, ErrorState, PageHeader } from '../../components/ui/misc'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime, formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type GateEntryLine } from '../../lib/types'
import { CountCell } from './CountCell'
import { useClients, useCompanies } from '../shared/queries'
import { GATE_TONE } from './GatePage'
import { emptyGateLine, gateLineSchema, gateLineToForm, loadSummary, type GateLineInput, type GateLineOutput } from './schema'

const UNITS = ['BOX', 'BAG', 'CARTON', 'CRATE', 'PALLET', 'KG', 'PCS']

function LineForm({ initial, saving, onClose, onSubmit }: {
  initial: GateLineInput; saving: boolean; onClose: () => void; onSubmit: (v: GateLineOutput) => void
}) {
  const { t } = useTranslation()
  const { register, handleSubmit, formState: { errors } } = useForm<GateLineInput, unknown, GateLineOutput>({
    resolver: zodResolver(gateLineSchema), defaultValues: initial,
  })
  const f = (name: keyof GateLineInput, label: string, opts: { optional?: boolean; type?: string; mode?: 'decimal' | 'numeric'; list?: string } = {}) => (
    <Field label={label} htmlFor={`gl-${name}`} error={errors[name]?.message} optional={opts.optional}>
      <Input id={`gl-${name}`} type={opts.type ?? 'text'} inputMode={opts.mode} list={opts.list} aria-invalid={!!errors[name]} {...register(name)} />
    </Field>
  )
  return (
    <Modal open size="lg" title={initial.item_name ? t('gate.editLine') : t('gate.addLine')} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="gate-line-form" loading={saving}>{t('common.save')}</Button>
      </>
    }>
      <form id="gate-line-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">{f('item_name', t('common.item'))}</div>
        {f('sku', 'SKU', { optional: true })}
        {f('batch_no', t('common.batch'), { optional: true })}
        {f('mfg_date', t('gate.mfgDate'), { optional: true, type: 'date' })}
        {f('expiry_date', t('common.expiry'), { optional: true, type: 'date' })}
        {f('declared_qty', t('gate.declaredQty'), { mode: 'decimal' })}
        {f('unit', t('common.unit'), { list: 'unit-list' })}
        <datalist id="unit-list">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        {f('packages', t('gate.packages'), { optional: true, mode: 'numeric' })}
        {f('weight_kg', t('gate.weightKg'), { optional: true, mode: 'decimal' })}
        <Field label={t('zones.storageType')} htmlFor="gl-storage_type" error={errors.storage_type?.message}>
          <Select id="gl-storage_type" {...register('storage_type')}>
            <option value="">{t('common.select')}</option>
            {Constants.public.Enums.storage_type.map((s) => <option key={s} value={s}>{t(`storageType.${s}`)}</option>)}
          </Select>
        </Field>
        {f('required_temp_c', t('gate.requiredTemp'), { optional: true, mode: 'decimal' })}
        <Field label={t('common.notes')} htmlFor="gl-remarks" optional className="sm:col-span-2"><Textarea id="gl-remarks" {...register('remarks')} /></Field>
      </form>
    </Modal>
  )
}

export function GateDetailPage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const decide = canDecide(profile?.role)
  const qc = useQueryClient()
  const clients = useClients()
  const [editLine, setEditLine] = useState<GateEntryLine | 'new' | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const gate = useQuery({
    queryKey: ['gate_entry', id],
    queryFn: async () => {
      const [g, l, r, d] = await Promise.all([
        supabase.from('gate_entries').select('*').eq('id', id).single(),
        supabase.from('gate_entry_lines').select('*').eq('gate_entry_id', id).is('deleted_at', null).order('line_no'),
        supabase.from('inward_receipts').select('id, receipt_no').eq('gate_entry_id', id).maybeSingle(),
        supabase.from('delivery_challans').select('id, challan_no').eq('gate_entry_id', id).maybeSingle(),
      ])
      if (g.error) throw g.error
      if (l.error) throw l.error
      return { gate: g.data, lines: l.data, receipt: r.data, challan: d.data }
    },
  })
  const companies = useCompanies(gate.data?.gate.client_id)

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['gate_entry', id] }); void qc.invalidateQueries({ queryKey: ['gate_entries'] }) }
  const fail = async (e: unknown) => toast.error(await errorMessage(e))

  const saveLine = useMutation({
    mutationFn: async (v: GateLineOutput) => {
      const g = gate.data!.gate
      const res = editLine && editLine !== 'new'
        ? await supabase.from('gate_entry_lines').update(v).eq('id', editLine.id)
        : await supabase.from('gate_entry_lines').insert({ ...v, gate_entry_id: g.id, warehouse_id: g.warehouse_id, client_id: g.client_id, line_no: undefined as never })
      if (res.error) throw res.error
    },
    onSuccess: () => { toast.success(t('common.saved')); setEditLine(null); refresh() },
    onError: fail,
  })
  const removeLine = useMutation({
    mutationFn: async (l: GateEntryLine) => { const { error } = await supabase.from('gate_entry_lines').update({ deleted_at: new Date().toISOString() }).eq('id', l.id); if (error) throw error },
    onSuccess: refresh, onError: fail,
  })
  const setStatus = useMutation({
    mutationFn: async (status: 'UNLOADING' | 'LOADING') => { const { error } = await supabase.from('gate_entries').update({ status }).eq('id', id); if (error) throw error },
    onSuccess: refresh, onError: fail,
  })
  const savePhotos = async (photos: string[]) => {
    const { error } = await supabase.from('gate_entries').update({ photos }).eq('id', id)
    if (error) return void (await fail(error))
    refresh()
  }
  const cancel = useMutation({
    mutationFn: async (reason: string) => { const { error } = await supabase.from('gate_entries').update({ status: 'CANCELLED', cancel_reason: reason }).eq('id', id); if (error) throw error },
    onSuccess: () => { toast.success(t('gate.cancelled')); setCancelling(false); refresh() },
    onError: fail,
  })

  if (gate.isPending || clients.isPending) return <FullPageSpinner />
  if (gate.error || !gate.data) return <ErrorState message={t('common.error')} onRetry={() => gate.refetch()} retryLabel={t('common.retry')} />
  const { gate: g, lines, receipt, challan } = gate.data
  const client = clients.data?.find((c) => c.id === g.client_id)
  const company = companies.data?.find((c) => c.id === g.company_id)
  const inward = g.direction === 'INWARD'
  const editable = inward && (g.status === 'AT_GATE' || g.status === 'UNLOADING')
  const sum = loadSummary(lines)
  const kv = (label: string, value: React.ReactNode) => (
    <div><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm font-medium">{value ?? '—'}</dd></div>
  )

  return (
    <div className="space-y-5">
      <Link to="/gate" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" />{t('common.back')}</Link>
      <PageHeader
        title={`${g.gate_pass_no ?? ''} · ${g.lorry_number}`}
        subtitle={<span className="inline-flex items-center gap-2"><Badge tone={GATE_TONE[g.status]}>{t(`gateStatus.${g.status}`)}</Badge>{t(`gateDirection.${g.direction}`)}</span>}
        actions={
          <>
            {inward && g.status === 'AT_GATE' && <Button variant="secondary" icon={<Play className="h-4 w-4" />} loading={setStatus.isPending} onClick={() => setStatus.mutate('UNLOADING')}>{t('gate.startUnloading')}</Button>}
            {!inward && g.status === 'AT_GATE' && <Button variant="secondary" icon={<Play className="h-4 w-4" />} loading={setStatus.isPending} onClick={() => setStatus.mutate('LOADING')}>{t('gate.startLoading')}</Button>}
            {editable && <Link to={`/gate/${g.id}/receive`} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${lines.length ? 'bg-brand-700 hover:bg-brand-800' : 'pointer-events-none bg-brand-700/50'}`}><ClipboardCheck className="h-4 w-4" />{t('gate.receiveGoods')}</Link>}
            {!inward && (g.status === 'AT_GATE' || g.status === 'LOADING') && <Link to="/dispatch" className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">{t('gate.goToDispatch')}</Link>}
            {receipt && <Link to={`/receipts/${receipt.id}`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">{receipt.receipt_no}</Link>}
            {challan && <Link to="/challans" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">{challan.challan_no}</Link>}
            {decide && ['AT_GATE', 'UNLOADING', 'LOADING'].includes(g.status) && <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelling(true)}>{t('common.cancelDoc')}</Button>}
          </>
        }
      />

      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kv(t('common.client'), client?.company_name)}
          {kv(inward ? t('gate.fromCompany') : t('gate.toCompany'), company?.name)}
          {kv(t('gate.driverName'), g.driver_name)}
          {kv(t('gate.driverPhone'), g.driver_phone)}
          {kv(t('gate.licence'), g.driver_licence_no)}
          {kv(t('gate.transporter'), g.transporter_name)}
          {kv(t('gate.lrNumber'), g.lr_number)}
          {kv(t('gate.invoiceNumber'), g.invoice_number)}
          {kv(t('gate.ewayBill'), g.eway_bill_number)}
          {kv(t('gate.ewayValid'), g.eway_valid_until ? formatDateTime(g.eway_valid_until, lang) : null)}
          {kv(t('gate.sealArrival'), g.seal_number_arrival)}
          {kv(t('gate.sealDeparture'), g.seal_number_departure)}
          {kv(t('gate.lorryTemp'), g.lorry_temp_c !== null ? `${g.lorry_temp_c} °C` : null)}
          {kv(t('gate.lorryType'), [g.lorry_type, g.capacity_tonnes ? `${g.capacity_tonnes} t` : null].filter(Boolean).join(' · '))}
          {kv(t('gate.gateIn'), formatDateTime(g.gate_in_at, lang))}
          {kv(t('gate.gateOut'), g.gate_out_at ? formatDateTime(g.gate_out_at, lang) : null)}
        </dl>
        {g.cancel_reason && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{t('common.reason')}: {g.cancel_reason}</p>}
      </Card>

      {inward && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">{t('gate.loadLines')} <span className="ml-2 text-sm font-normal text-slate-500">{t('gate.loadSummary', { lines: sum.lines, packages: sum.packages, tonnes: sum.tonnes })}</span></h2>
            {editable && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditLine('new')}>{t('gate.addLine')}</Button>}
          </div>
          {lines.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{t('gate.noLines')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">{t('common.item')}</th><th className="px-4 py-2">{t('common.batch')}</th><th className="px-4 py-2">{t('common.expiry')}</th><th className="px-4 py-2">{t('gate.declaredQty')}</th><th className="px-4 py-2">{t('gate.weightKg')}</th>{g.direction === 'INWARD' && <th className="px-4 py-2">{t('gate.counted')}</th>}<th className="px-4 py-2">{t('gate.requirement')}</th><th className="px-4 py-2">{t('common.status')}</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2">{l.line_no}</td>
                      <td className="px-4 py-2 font-medium">{l.item_name}{l.sku && <span className="block font-mono text-xs text-slate-500">{l.sku}</span>}</td>
                      <td className="px-4 py-2">{l.batch_no ?? '—'}</td>
                      <td className="px-4 py-2">{l.expiry_date ? formatDate(l.expiry_date, lang) : '—'}</td>
                      <td className="px-4 py-2">{formatNumber(l.declared_qty, lang, 3)} {l.unit}</td>
                      <td className="px-4 py-2">{formatNumber(l.weight_kg, lang)}</td>
                      {g.direction === 'INWARD' && <td className="px-4 py-2">{editable ? <CountCell line={l} onSaved={refresh} /> : (l.counted_qty ?? '—')}</td>}
                      <td className="px-4 py-2">{l.required_temp_c !== null ? `${l.required_temp_c} °C` : ''} {l.storage_type ? t(`storageType.${l.storage_type}`) : ''}</td>
                      <td className="px-4 py-2">{l.condition ? <Badge tone={l.condition === 'GOOD' ? 'green' : 'amber'}>{t(`lineCondition.${l.condition}`)}</Badge> : '—'}</td>
                      <td className="px-4 py-2 text-right">
                        {editable && (
                          <span className="inline-flex gap-1">
                            <Button size="sm" variant="ghost" aria-label={t('common.edit')} icon={<Pencil className="h-4 w-4" />} onClick={() => setEditLine(l)} />
                            <Button size="sm" variant="ghost" aria-label={t('common.remove')} icon={<Trash2 className="h-4 w-4" />} onClick={() => removeLine.mutate(l)} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">{t('gate.photos')}</h2>
        <PhotoUpload warehouseId={g.warehouse_id} folder={g.id} paths={g.photos} onChange={savePhotos} disabled={g.status === 'CANCELLED'} />
      </Card>

      {editLine && (
        <LineForm
          initial={editLine === 'new' ? emptyGateLine : gateLineToForm(editLine)}
          saving={saveLine.isPending}
          onClose={() => setEditLine(null)}
          onSubmit={(v) => saveLine.mutate(v)}
        />
      )}
      <ReasonDialog open={cancelling} title={t('gate.cancelTitle')} loading={cancel.isPending} onConfirm={(r) => cancel.mutate(r)} onClose={() => setCancelling(false)} />
    </div>
  )
}
