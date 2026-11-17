import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Ban, Boxes, CircleCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select } from '../../components/ui/Field'
import { Badge, Card, EmptyState, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { Constants, type BrigadeSlot, type SlotStatus } from '../../lib/types'
import { qk, useBrigadeTypes, useWarehouses, useZones } from '../shared/queries'
import { MAX_SLOTS_PER_REQUEST, slotBuilderSchema, slotPreview, type SlotBuilderInput, type SlotBuilderOutput } from './schema'

const STATUS_TONE: Record<SlotStatus, 'green' | 'blue' | 'amber'> = { FREE: 'green', OCCUPIED: 'blue', BLOCKED: 'amber' }

function SlotList({ zoneId, writable, brigadeNames }: { zoneId: string; writable: boolean; brigadeNames: Map<string, string> }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])
  useEffect(() => setPagination((p) => ({ ...p, pageIndex: 0 })), [zoneId, status, debounced])

  const slots = useQuery({
    queryKey: ['slots', zoneId, status, debounced, pagination.pageIndex, pagination.pageSize],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = pagination.pageIndex * pagination.pageSize
      let q = supabase
        .from('brigade_slots')
        .select('*', { count: 'exact' })
        .eq('zone_id', zoneId)
        .is('deleted_at', null)
        .order('aisle').order('rack').order('level').order('position')
        .range(from, from + pagination.pageSize - 1)
      if (status) q = q.eq('status', status as SlotStatus)
      if (debounced) q = q.ilike('code', `%${debounced.replace(/[%_]/g, '')}%`)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data, count: count ?? 0 }
    },
  })

  const setSlotStatus = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: SlotStatus }) => {
      const { error } = await supabase.from('brigade_slots').update({ status: next }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t('slots.statusUpdated'))
      void qc.invalidateQueries({ queryKey: ['slots', zoneId] })
      void qc.invalidateQueries({ queryKey: qk.summary })
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const columns = useMemo<ColumnDef<BrigadeSlot>[]>(() => [
    { accessorKey: 'code', header: t('common.code'), cell: (c) => <span className="font-mono">{c.getValue<string>()}</span> },
    { accessorKey: 'aisle', header: t('slots.aisle') },
    { accessorKey: 'rack', header: t('slots.rack') },
    { accessorKey: 'level', header: t('slots.level') },
    { accessorKey: 'position', header: t('slots.position') },
    { id: 'type', header: t('slots.brigadeType'), cell: (c) => brigadeNames.get(c.row.original.brigade_type_id) ?? '—' },
    {
      accessorKey: 'status',
      header: t('common.status'),
      cell: (c) => <Badge tone={STATUS_TONE[c.getValue<SlotStatus>()]}>{t(`slotStatus.${c.getValue<string>()}`)}</Badge>,
    },
    ...(writable ? [{
      id: 'actions',
      header: t('common.actions'),
      // OCCUPIED will be driven by stock movements (Phase 2); here only FREE <-> BLOCKED
      cell: ({ row }) => row.original.status === 'OCCUPIED' ? null : row.original.status === 'FREE' ? (
        <Button size="sm" variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setSlotStatus.mutate({ id: row.original.id, next: 'BLOCKED' })}>{t('slots.block')}</Button>
      ) : (
        <Button size="sm" variant="ghost" icon={<CircleCheck className="h-4 w-4" />} onClick={() => setSlotStatus.mutate({ id: row.original.id, next: 'FREE' })}>{t('slots.unblock')}</Button>
      ),
    } satisfies ColumnDef<BrigadeSlot>] : []),
  ], [t, writable, brigadeNames, setSlotStatus])

  return (
    <Card>
      <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{t('slots.list')}</h2>
      <Toolbar>
        <Input placeholder={t('slots.searchCode')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('slots.searchCode')} />
        <Select aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
          <option value="">{t('common.all')}</option>
          {Constants.public.Enums.slot_status.map((s) => <option key={s} value={s}>{t(`slotStatus.${s}`)}</option>)}
        </Select>
      </Toolbar>
      <DataTable
        data={slots.data?.rows}
        columns={columns}
        loading={slots.isPending}
        error={slots.error ? t('common.error') : null}
        onRetry={() => slots.refetch()}
        filtered={!!status || !!debounced}
        server={{ pagination, onPaginationChange: setPagination, rowCount: slots.data?.count ?? 0 }}
      />
    </Card>
  )
}

export function SlotBuilderPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const writable = canWrite(profile?.role, 'slots')
  const qc = useQueryClient()
  const warehouses = useWarehouses()
  const brigadeTypes = useBrigadeTypes()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SlotBuilderInput, unknown, SlotBuilderOutput>({
    resolver: zodResolver(slotBuilderSchema),
    defaultValues: { warehouse_id: '', zone_id: '', brigade_type_id: '', aisles: '10', racks: '5', levels: '2', slots_per_level: '1', aisle_start: '1' },
  })
  const warehouseId = watch('warehouse_id')
  const zoneId = watch('zone_id')
  const zones = useZones(warehouseId || undefined)

  // sensible defaults: single warehouse, default brigade type
  useEffect(() => {
    if (!warehouseId && warehouses.data?.length === 1) setValue('warehouse_id', warehouses.data[0].id)
  }, [warehouses.data, warehouseId, setValue])
  useEffect(() => {
    const def = brigadeTypes.data?.find((b) => b.is_default && b.is_active)
    if (def && !watch('brigade_type_id')) setValue('brigade_type_id', def.id)
  }, [brigadeTypes.data, setValue, watch])
  useEffect(() => {
    if (zoneId && zones.data && !zones.data.some((z) => z.id === zoneId)) setValue('zone_id', '')
  }, [zones.data, zoneId, setValue])

  const warehouse = warehouses.data?.find((w) => w.id === warehouseId)
  const zone = zones.data?.find((z) => z.id === zoneId)
  const nums = ['aisles', 'racks', 'levels', 'slots_per_level', 'aisle_start'] as const
  const values = Object.fromEntries(nums.map((k) => [k, Number(watch(k))])) as Record<(typeof nums)[number], number>
  const valid = nums.every((k) => Number.isInteger(values[k]) && values[k] >= 1)
  const preview = valid && warehouse && zone ? slotPreview(values, warehouse.code, zone.code) : null
  const brigadeNames = useMemo(() => new Map((brigadeTypes.data ?? []).map((b) => [b.id, b.name])), [brigadeTypes.data])

  const build = useMutation({
    mutationFn: async (v: SlotBuilderOutput) => {
      const { data, error } = await supabase.rpc('create_brigade_slots', {
        p_zone_id: v.zone_id,
        p_brigade_type_id: v.brigade_type_id,
        p_aisles: v.aisles,
        p_racks: v.racks,
        p_levels: v.levels,
        p_slots_per_level: v.slots_per_level,
        p_aisle_start: v.aisle_start,
      })
      if (error) throw error
      const requested = v.aisles * v.racks * v.levels * v.slots_per_level
      return { created: data ?? 0, skipped: requested - (data ?? 0) }
    },
    onSuccess: (r) => {
      toast.success(t('slots.created', r))
      void qc.invalidateQueries({ queryKey: ['slots'] })
      void qc.invalidateQueries({ queryKey: qk.summary })
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const numField = (name: (typeof nums)[number], label: string) => (
    <Field label={label} htmlFor={`sb-${name}`} error={errors[name]?.message}>
      <Input id={`sb-${name}`} type="number" min={1} inputMode="numeric" {...register(name)} />
    </Field>
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t('slots.title')} subtitle={!writable ? t('common.readOnly') : undefined} />
      <Card className="p-4">
        <form onSubmit={handleSubmit((v) => build.mutate(v))} noValidate className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t('common.warehouse')} htmlFor="sb-wh" error={errors.warehouse_id?.message}>
              <Select id="sb-wh" {...register('warehouse_id')}>
                <option value="">{t('common.select')}</option>
                {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
              </Select>
            </Field>
            <Field label={t('common.zone')} htmlFor="sb-zone" error={errors.zone_id?.message}>
              <Select id="sb-zone" {...register('zone_id')}>
                <option value="">{t('common.select')}</option>
                {zones.data?.map((z) => <option key={z.id} value={z.id}>{z.code} · {z.name} ({t(`storageType.${z.storage_type}`)})</option>)}
              </Select>
            </Field>
            {writable && (
              <Field label={t('slots.brigadeType')} htmlFor="sb-bt" error={errors.brigade_type_id?.message}>
                <Select id="sb-bt" {...register('brigade_type_id')}>
                  <option value="">{t('common.select')}</option>
                  {brigadeTypes.data?.filter((b) => b.is_active).map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.length_m}×{b.width_m}×{b.height_m} m)</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {writable && (
            <>
              <h2 className="pt-2 font-semibold">{t('slots.builder')}</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {numField('aisles', t('slots.aisles'))}
                {numField('racks', t('slots.racks'))}
                {numField('levels', t('slots.levels'))}
                {numField('slots_per_level', t('slots.slotsPerLevel'))}
                {numField('aisle_start', t('slots.aisleStart'))}
              </div>
              {preview && (
                <div className={`rounded-lg px-3 py-2 text-sm ${preview.count > MAX_SLOTS_PER_REQUEST ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-800'}`}>
                  {t('slots.preview', { count: preview.count })}{' '}
                  <span className="font-mono">{t('slots.sample', { first: preview.first, last: preview.last })}</span>
                </div>
              )}
              <Button type="submit" icon={<Boxes className="h-4 w-4" />} loading={build.isPending} disabled={!zoneId}>
                {t('slots.create')}
              </Button>
            </>
          )}
        </form>
      </Card>

      {zoneId ? (
        <SlotList zoneId={zoneId} writable={writable} brigadeNames={brigadeNames} />
      ) : (
        <Card><EmptyState message={warehouses.data?.length === 0 ? t('slots.noWarehouses') : t('slots.pickZone')} /></Card>
      )}
    </div>
  )
}
