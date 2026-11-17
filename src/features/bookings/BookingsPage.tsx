import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, Check, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canDecide } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ReasonDialog } from '../../components/ui/ReasonDialog'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatTemperatureRange } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type BookingStatus, type SpaceBooking } from '../../lib/types'
import { useBrigadeTypes, useClients, useWarehouses } from '../shared/queries'
import { bookingSchema, emptyBooking, type BookingFormInput, type BookingFormOutput } from './schema'

export const BOOKING_TONE: Record<BookingStatus, 'amber' | 'green' | 'red' | 'gray' | 'blue'> = {
  REQUESTED: 'amber', APPROVED: 'green', REJECTED: 'red', CANCELLED: 'gray', COMPLETED: 'blue',
}

function tempLabel(b: Pick<SpaceBooking, 'temp_setpoint_c' | 'temp_min' | 'temp_max'>) {
  if (b.temp_setpoint_c !== null) return `${b.temp_setpoint_c} °C`
  return formatTemperatureRange(b.temp_min, b.temp_max)
}

function BookingForm({ initial, lockClient, saving, onClose, onSubmit }: {
  initial: BookingFormInput; lockClient: boolean; saving: boolean; onClose: () => void; onSubmit: (v: BookingFormOutput) => void
}) {
  const { t } = useTranslation()
  const clients = useClients()
  const warehouses = useWarehouses()
  const brigadeTypes = useBrigadeTypes()
  const [avail, setAvail] = useState<{ zone_code: string; zone_name: string; storage_type: string; free_slots: number; temp_min: number | null; temp_max: number | null }[] | null>(null)
  const [checking, setChecking] = useState(false)
  const { register, handleSubmit, watch, getValues, trigger, formState: { errors } } = useForm<BookingFormInput, unknown, BookingFormOutput>({
    resolver: zodResolver(bookingSchema), defaultValues: initial,
  })
  const type = watch('storage_type')

  const check = async () => {
    if (!(await trigger())) return
    const v = bookingSchema.parse(getValues())
    setChecking(true)
    const { data, error } = await supabase.rpc('check_space_availability', {
      p_warehouse_id: v.warehouse_id, p_storage_type: v.storage_type, p_setpoint: v.temp_setpoint_c ?? undefined,
      p_temp_min: v.temp_min ?? undefined, p_temp_max: v.temp_max ?? undefined, p_brigade_type_id: v.brigade_type_id ?? undefined,
    })
    setChecking(false)
    if (error) return void toast.error(await errorMessage(error))
    setAvail(data as never)
  }

  const total = avail?.reduce((n, z) => n + z.free_slots, 0) ?? 0
  const wanted = Number(watch('brigades_requested')) || 0

  return (
    <Modal open size="lg" title={t('bookings.add')} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="booking-form" loading={saving}>{t('bookings.submit')}</Button>
      </>
    }>
      <form id="booking-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('common.client')} htmlFor="bk-client" error={errors.client_id?.message}>
          <Select id="bk-client" disabled={lockClient} {...register('client_id')}>
            <option value="">{t('common.select')}</option>
            {clients.data?.filter((c) => c.status === 'ACTIVE').map((c) => <option key={c.id} value={c.id}>{c.code} · {c.company_name}</option>)}
          </Select>
        </Field>
        <Field label={t('common.warehouse')} htmlFor="bk-wh" error={errors.warehouse_id?.message}>
          <Select id="bk-wh" {...register('warehouse_id')}>
            <option value="">{t('common.select')}</option>
            {warehouses.data?.filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
          </Select>
        </Field>
        <Field label={t('zones.storageType')} htmlFor="bk-type" error={errors.storage_type?.message}>
          <Select id="bk-type" {...register('storage_type')}>
            {Constants.public.Enums.storage_type.map((s) => <option key={s} value={s}>{t(`storageType.${s}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('slots.brigadeType')} htmlFor="bk-bt" optional>
          <Select id="bk-bt" {...register('brigade_type_id')}>
            <option value="">{t('bookings.anyBrigade')}</option>
            {brigadeTypes.data?.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        {type !== 'DRY' && (
          <>
            <Field label={t('bookings.setpoint')} htmlFor="bk-set" error={errors.temp_setpoint_c?.message} hint={t('bookings.setpointHelp')}>
              <Input id="bk-set" inputMode="decimal" {...register('temp_setpoint_c')} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('zones.tempMin')} htmlFor="bk-min" optional error={errors.temp_min?.message}><Input id="bk-min" inputMode="decimal" {...register('temp_min')} /></Field>
              <Field label={t('zones.tempMax')} htmlFor="bk-max" optional error={errors.temp_max?.message}><Input id="bk-max" inputMode="decimal" {...register('temp_max')} /></Field>
            </div>
          </>
        )}
        <Field label={t('bookings.brigades')} htmlFor="bk-n" error={errors.brigades_requested?.message}>
          <Input id="bk-n" type="number" min={1} {...register('brigades_requested')} />
        </Field>
        <Field label={t('bookings.fromDate')} htmlFor="bk-from" error={errors.from_date?.message}>
          <Input id="bk-from" type="date" {...register('from_date')} />
        </Field>
        <Field label={t('bookings.expectedDays')} htmlFor="bk-days" error={errors.expected_days?.message}>
          <Input id="bk-days" type="number" min={1} {...register('expected_days')} />
        </Field>
        <Field label={t('common.notes')} htmlFor="bk-rem" optional className="sm:col-span-2"><Textarea id="bk-rem" {...register('remarks')} /></Field>
      </form>
      <div className="mt-4 rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('bookings.availability')}</h3>
          <Button size="sm" variant="secondary" loading={checking} icon={<Search className="h-4 w-4" />} onClick={check}>{t('bookings.checkAvailability')}</Button>
        </div>
        {avail && (
          <div className="mt-2 text-sm" data-testid="availability">
            {avail.length === 0 ? (
              <p className="text-red-700">{t('bookings.noMatchingZone')}</p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {avail.map((z) => (
                    <li key={z.zone_code} className="flex justify-between py-1">
                      <span>{z.zone_code} · {z.zone_name} <span className="text-slate-500">({formatTemperatureRange(z.temp_min, z.temp_max)})</span></span>
                      <span className="font-medium">{z.free_slots} {t('dashboard.free').toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
                <p className={`mt-2 font-medium ${total >= wanted ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {t('bookings.totalFree', { count: total })} {total < wanted ? `· ${t('bookings.notEnough')}` : ''}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function BookingsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const decide = canDecide(profile?.role)
  const qc = useQueryClient()
  const clients = useClients()
  const warehouses = useWarehouses()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [rejecting, setRejecting] = useState<SpaceBooking | null>(null)
  const [cancelling, setCancelling] = useState<SpaceBooking | null>(null)

  const list = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('space_bookings').select('*').is('deleted_at', null).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['bookings'] }); void qc.invalidateQueries({ queryKey: ['v_zone_slot_summary'] }) }
  const fail = async (e: unknown) => toast.error(await errorMessage(e))

  const create = useMutation({
    mutationFn: async (v: BookingFormOutput) => { const { error } = await supabase.from('space_bookings').insert(v); if (error) throw error },
    onSuccess: () => { toast.success(t('bookings.requested')); setCreating(false); refresh() },
    onError: fail,
  })
  const approve = useMutation({
    mutationFn: async (b: SpaceBooking) => { const { data, error } = await supabase.rpc('approve_booking', { p_booking_id: b.id }); if (error) throw error; return data },
    onSuccess: (n) => { toast.success(t('bookings.approvedN', { count: n })); refresh() },
    onError: fail,
  })
  const reject = useMutation({
    mutationFn: async ({ b, reason }: { b: SpaceBooking; reason: string }) => { const { error } = await supabase.rpc('reject_booking', { p_booking_id: b.id, p_note: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('bookings.rejected')); setRejecting(null); refresh() },
    onError: fail,
  })
  const cancel = useMutation({
    mutationFn: async ({ b, reason }: { b: SpaceBooking; reason: string }) => { const { error } = await supabase.rpc('cancel_booking', { p_booking_id: b.id, p_reason: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('bookings.cancelled')); setCancelling(null); refresh() },
    onError: fail,
  })

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const whName = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, w.code])), [warehouses.data])
  const rows = useMemo(() => (list.data ?? []).filter((b) => !statusFilter || b.status === statusFilter), [list.data, statusFilter])

  const columns = useMemo<ColumnDef<SpaceBooking>[]>(() => [
    { accessorKey: 'booking_no', header: t('bookings.no'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string | null>()}</span> },
    ...(!isClient ? [{ id: 'client', header: t('common.client'), accessorFn: (b: SpaceBooking) => clientName.get(b.client_id) ?? '' } satisfies ColumnDef<SpaceBooking>] : []),
    { id: 'wh', header: t('common.warehouse'), accessorFn: (b) => whName.get(b.warehouse_id) ?? '' },
    { accessorKey: 'storage_type', header: t('zones.storageType'), cell: (c) => t(`storageType.${c.getValue<string>()}`) },
    { id: 'temp', header: t('zones.tempRange'), cell: (c) => tempLabel(c.row.original) },
    { accessorKey: 'brigades_requested', header: t('bookings.brigades') },
    { accessorKey: 'reserved_count', header: t('bookings.reserved') },
    { accessorKey: 'from_date', header: t('bookings.fromDate'), cell: (c) => formatDate(c.getValue<string>(), lang) },
    { accessorKey: 'expected_days', header: t('bookings.expectedDays') },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={BOOKING_TONE[c.getValue<BookingStatus>()]}>{t(`bookingStatus.${c.getValue<string>()}`)}</Badge> },
    {
      id: 'actions', header: t('common.actions'),
      cell: ({ row }) => {
        const b = row.original
        return (
          <div className="flex gap-1">
            {decide && b.status === 'REQUESTED' && (
              <>
                <Button size="sm" icon={<Check className="h-4 w-4" />} loading={approve.isPending && approve.variables?.id === b.id} onClick={() => approve.mutate(b)}>{t('common.approve')}</Button>
                <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => setRejecting(b)}>{t('common.reject')}</Button>
              </>
            )}
            {((decide && (b.status === 'REQUESTED' || b.status === 'APPROVED')) || (isClient && b.status === 'REQUESTED')) && (
              <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelling(b)}>{t('common.cancelDoc')}</Button>
            )}
          </div>
        )
      },
    },
  ], [t, lang, isClient, decide, clientName, whName, approve])

  const myClient = isClient ? (profile?.client_id ?? '') : ''
  const onlyWh = warehouses.data?.length === 1 ? warehouses.data[0].id : ''

  return (
    <div>
      <PageHeader title={t('bookings.title')} subtitle={isClient ? t('bookings.clientHelp') : undefined}
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('bookings.add')}</Button>} />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('common.search')} />
          <Select aria-label={t('common.status')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44">
            <option value="">{t('common.all')}</option>
            {Constants.public.Enums.booking_status.map((s) => <option key={s} value={s}>{t(`bookingStatus.${s}`)}</option>)}
          </Select>
        </Toolbar>
        <DataTable data={rows} columns={columns} loading={list.isPending || clients.isPending} error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()} search={search} filtered={!!statusFilter} emptyMessage={t('bookings.empty')} />
      </Card>
      {creating && (
        <BookingForm initial={emptyBooking(myClient, onlyWh)} lockClient={isClient} saving={create.isPending}
          onClose={() => setCreating(false)} onSubmit={(v) => create.mutate(v)} />
      )}
      <ReasonDialog open={!!rejecting} title={t('bookings.rejectTitle')} confirmLabel={t('common.reject')} loading={reject.isPending}
        onConfirm={(reason) => rejecting && reject.mutate({ b: rejecting, reason })} onClose={() => setRejecting(null)} />
      <ReasonDialog open={!!cancelling} title={t('bookings.cancelTitle')} message={t('bookings.cancelHelp')} loading={cancel.isPending}
        onConfirm={(reason) => cancelling && cancel.mutate({ b: cancelling, reason })} onClose={() => setCancelling(null)} />
    </div>
  )
}
