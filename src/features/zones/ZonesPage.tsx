import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatTemperatureRange } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type Zone } from '../../lib/types'
import { qk, useWarehouses, useZones } from '../shared/queries'
import { emptyZone, TEMPERATURE_FORBIDDEN, zoneSchema, zoneToForm, type ZoneFormInput, type ZoneFormOutput } from './schema'

function ZoneForm({
  initial, title, saving, onClose, onSubmit, lockWarehouse,
}: {
  initial: ZoneFormInput
  title: string
  saving: boolean
  lockWarehouse: boolean
  onClose: () => void
  onSubmit: (v: ZoneFormOutput) => void
}) {
  const { t } = useTranslation()
  const warehouses = useWarehouses()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ZoneFormInput, unknown, ZoneFormOutput>({
    resolver: zodResolver(zoneSchema),
    defaultValues: initial,
  })
  const storageType = watch('storage_type')
  const noTemp = TEMPERATURE_FORBIDDEN.includes(storageType)
  useEffect(() => {
    if (noTemp) {
      setValue('temp_min', '')
      setValue('temp_max', '')
    }
  }, [noTemp, setValue])

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" form="zone-form" loading={saving}>{t('common.save')}</Button>
        </>
      }
    >
      <form id="zone-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('common.warehouse')} htmlFor="z-wh" error={errors.warehouse_id?.message} className="sm:col-span-2">
          {lockWarehouse ? (
            <>
              <input type="hidden" {...register('warehouse_id')} />
              <Input id="z-wh" readOnly className="bg-slate-100" value={(() => { const w = warehouses.data?.find((x) => x.id === initial.warehouse_id); return w ? `${w.code} · ${w.name}` : '' })()} />
            </>
          ) : (
            <Select id="z-wh" {...register('warehouse_id')}>
              <option value="">{t('common.select')}</option>
              {warehouses.data?.filter((w) => w.is_active).map((w) => (
                <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('common.code')} htmlFor="z-code" optional hint={t('zones.codeHelp')} error={errors.code?.message}>
          <Input id="z-code" {...register('code')} />
        </Field>
        <Field label={t('common.name')} htmlFor="z-name" error={errors.name?.message}>
          <Input id="z-name" {...register('name')} />
        </Field>
        <Field label={t('zones.storageType')} htmlFor="z-type" error={errors.storage_type?.message} className="sm:col-span-2">
          <Select id="z-type" {...register('storage_type')}>
            {Constants.public.Enums.storage_type.map((s) => (
              <option key={s} value={s}>{t(`storageType.${s}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('zones.tempMin')} htmlFor="z-min" error={errors.temp_min?.message}>
          <Input id="z-min" inputMode="decimal" readOnly={noTemp} className={noTemp ? 'bg-slate-100' : undefined} {...register('temp_min')} />
        </Field>
        <Field label={t('zones.tempMax')} htmlFor="z-max" error={errors.temp_max?.message}>
          <Input id="z-max" inputMode="decimal" readOnly={noTemp} className={noTemp ? 'bg-slate-100' : undefined} {...register('temp_max')} />
        </Field>
        <Field label={t('common.notes')} htmlFor="z-notes" optional error={errors.notes?.message} className="sm:col-span-2">
          <Textarea id="z-notes" {...register('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

export function ZonesPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const writable = canWrite(profile?.role, 'zones')
  const qc = useQueryClient()
  const warehouses = useWarehouses()
  const [warehouseId, setWarehouseId] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const zones = useZones(warehouseId || undefined)
  const [editing, setEditing] = useState<Zone | 'new' | null>(null)
  const [removing, setRemoving] = useState<Zone | null>(null)

  const whName = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, `${w.code} · ${w.name}`])), [warehouses.data])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['zones'] })
    void qc.invalidateQueries({ queryKey: qk.summary })
  }

  const save = useMutation({
    mutationFn: async (v: ZoneFormOutput) => {
      const res =
        editing && editing !== 'new'
          ? await supabase.from('zones').update(v).eq('id', editing.id)
          : await supabase.from('zones').insert(v)
      if (res.error) throw res.error
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? t('zones.added') : t('zones.updated'))
      setEditing(null)
      invalidate()
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: async (z: Zone) => {
      // soft delete
      const { error } = await supabase.from('zones').update({ deleted_at: new Date().toISOString() }).eq('id', z.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t('zones.removed'))
      setRemoving(null)
      invalidate()
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const data = useMemo(() => (zones.data ?? []).filter((z) => !typeFilter || z.storage_type === typeFilter), [zones.data, typeFilter])

  const columns = useMemo<ColumnDef<Zone>[]>(
    () => [
      { id: 'warehouse', header: t('common.warehouse'), accessorFn: (z) => whName.get(z.warehouse_id) ?? '' },
      { accessorKey: 'code', header: t('common.code'), cell: (c) => <span className="font-mono">{c.getValue<string>()}</span> },
      { accessorKey: 'name', header: t('common.name') },
      {
        accessorKey: 'storage_type',
        header: t('zones.storageType'),
        cell: (c) => <Badge tone={c.getValue() === 'DRY' ? 'amber' : 'cyan'}>{t(`storageType.${c.getValue<string>()}`)}</Badge>,
      },
      { id: 'temp', header: t('zones.tempRange'), cell: (c) => formatTemperatureRange(c.row.original.temp_min, c.row.original.temp_max) },
      ...(writable
        ? [
            {
              id: 'actions',
              header: t('common.actions'),
              cell: ({ row }) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(row.original)}>{t('common.edit')}</Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setRemoving(row.original)}>{t('common.delete')}</Button>
                </div>
              ),
            } satisfies ColumnDef<Zone>,
          ]
        : []),
    ],
    [t, whName, writable],
  )

  return (
    <div>
      <PageHeader
        title={t('zones.title')}
        subtitle={!writable ? t('common.readOnly') : undefined}
        actions={writable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>{t('zones.add')}</Button>}
      />
      <Card>
        <Toolbar>
          <Select aria-label={t('common.warehouse')} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="sm:w-64">
            <option value="">{t('dashboard.allWarehouses')}</option>
            {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
          </Select>
          <Select aria-label={t('zones.storageType')} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-48">
            <option value="">{t('common.all')}</option>
            {Constants.public.Enums.storage_type.map((s) => <option key={s} value={s}>{t(`storageType.${s}`)}</option>)}
          </Select>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('common.search')} />
        </Toolbar>
        <DataTable
          data={data}
          columns={columns}
          loading={zones.isPending}
          error={zones.error ? t('common.error') : null}
          onRetry={() => zones.refetch()}
          search={search}
          filtered={!!typeFilter || !!warehouseId}
        />
      </Card>
      {editing && (
        <ZoneForm
          title={editing === 'new' ? t('zones.add') : t('zones.edit')}
          initial={editing === 'new' ? emptyZone(warehouseId || (warehouses.data?.length === 1 ? warehouses.data[0].id : '')) : zoneToForm(editing)}
          lockWarehouse={editing !== 'new'}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => save.mutate(v)}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        title={t('common.delete')}
        message={removing ? t('zones.deleteConfirm', { name: removing.name }) : ''}
        danger
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
        onClose={() => setRemoving(null)}
      />
    </div>
  )
}
