import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { MapPin, Pencil, Plus, Power, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Input, Select } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Warehouse } from '../../lib/types'
import { qk, useWarehouses } from '../shared/queries'
import { emptyWarehouse, toFormValues, toPayload, type WarehouseFormOutput } from './schema'
import { WarehouseForm } from './WarehouseForm'
import { ManagersDialog } from './ManagersDialog'

export function WarehousesPage() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const writable = canWrite(profile?.role, 'warehouses')
  const qc = useQueryClient()
  const list = useWarehouses()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null)
  const [toggling, setToggling] = useState<Warehouse | null>(null)
  const [managing, setManaging] = useState<Warehouse | null>(null)

  const save = useMutation({
    mutationFn: async (v: WarehouseFormOutput) => {
      const payload = toPayload(v)
      const res =
        editing && editing !== 'new'
          ? await supabase.from('warehouses').update(payload).eq('id', editing.id)
          : await supabase.from('warehouses').insert(payload)
      if (res.error) throw res.error
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? t('warehouses.added') : t('warehouses.updated'))
      setEditing(null)
      void qc.invalidateQueries({ queryKey: qk.warehouses })
      void qc.invalidateQueries({ queryKey: qk.summary })
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const toggle = useMutation({
    mutationFn: async (w: Warehouse) => {
      const { error } = await supabase.from('warehouses').update({ is_active: !w.is_active }).eq('id', w.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t('warehouses.updated'))
      setToggling(null)
      void qc.invalidateQueries({ queryKey: qk.warehouses })
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const data = useMemo(
    () =>
      (list.data ?? []).filter((w) =>
        statusFilter === 'all' ? true : statusFilter === 'active' ? w.is_active : !w.is_active,
      ),
    [list.data, statusFilter],
  )

  const columns = useMemo<ColumnDef<Warehouse>[]>(
    () => [
      { accessorKey: 'code', header: t('common.code'), cell: (c) => <span className="font-mono">{c.getValue<string>()}</span> },
      { accessorKey: 'name', header: t('common.name'), cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
      {
        id: 'place',
        header: t('warehouses.location'),
        accessorFn: (w) => [w.city, w.district, w.state].filter(Boolean).join(', '),
        cell: (c) => {
          const w = c.row.original
          return (
            <span className="inline-flex items-center gap-2">
              {c.getValue<string>()}
              {w.latitude !== null && w.longitude !== null && (
                <a
                  className="inline-flex items-center gap-0.5 text-xs text-brand-700 hover:underline"
                  href={`https://www.google.com/maps?q=${w.latitude},${w.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin className="h-3 w-3" />{t('warehouses.mapLink')}
                </a>
              )}
            </span>
          )
        },
      },
      {
        accessorKey: 'total_area_sqft',
        header: t('warehouses.area'),
        cell: (c) => formatNumber(c.getValue<number | null>(), i18n.resolvedLanguage),
      },
      { accessorKey: 'contact_phone', header: t('warehouses.contactPhone'), cell: (c) => c.getValue<string | null>() ?? '—' },
      {
        id: 'hours',
        header: t('warehouses.hours'),
        cell: (c) => {
          const w = c.row.original
          if (w.is_24x7) return '24 x 7'
          return w.opens_at && w.closes_at ? `${w.opens_at.slice(0, 5)}–${w.closes_at.slice(0, 5)}` : '—'
        },
      },
      {
        accessorKey: 'is_active',
        header: t('common.status'),
        cell: (c) => (c.getValue() ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>),
      },
      ...(writable
        ? [
            {
              id: 'actions',
              header: t('common.actions'),
              cell: ({ row }) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(row.original)}>
                    {t('common.edit')}
                  </Button>
                  {profile?.role === 'SUPER_ADMIN' && <Button size="sm" variant="ghost" icon={<Users className="h-4 w-4" />} onClick={() => setManaging(row.original)}>{t('managers.manage')}</Button>}
                  <Button size="sm" variant="ghost" icon={<Power className="h-4 w-4" />} onClick={() => setToggling(row.original)}>
                    {row.original.is_active ? t('common.deactivate') : t('common.activate')}
                  </Button>
                </div>
              ),
            } satisfies ColumnDef<Warehouse>,
          ]
        : []),
    ],
    [t, i18n.resolvedLanguage, writable, profile?.role],
  )

  return (
    <div>
      <PageHeader
        title={t('warehouses.title')}
        subtitle={!writable ? t('common.readOnly') : undefined}
        actions={writable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>{t('warehouses.add')}</Button>}
      />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-72" aria-label={t('common.search')} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="sm:w-40" aria-label={t('common.status')}>
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
            <option value="all">{t('common.all')}</option>
          </Select>
        </Toolbar>
        <DataTable
          data={data}
          columns={columns}
          loading={list.isPending}
          error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()}
          search={search}
          filtered={statusFilter !== 'active'}
        />
      </Card>

      {editing && (
        <WarehouseForm
          open
          title={editing === 'new' ? t('warehouses.add') : t('warehouses.edit')}
          initial={editing === 'new' ? emptyWarehouse : toFormValues(editing)}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => save.mutate(v)}
        />
      )}
      {managing && <ManagersDialog warehouseId={managing.id} warehouseName={managing.name} onClose={() => setManaging(null)} />}
      <ConfirmDialog
        open={!!toggling}
        title={toggling?.is_active ? t('common.deactivate') : t('common.activate')}
        message={toggling ? t(toggling.is_active ? 'warehouses.deactivateConfirm' : 'warehouses.activateConfirm', { name: toggling.name }) : ''}
        danger={toggling?.is_active}
        loading={toggle.isPending}
        onConfirm={() => toggling && toggle.mutate(toggling)}
        onClose={() => setToggling(null)}
      />
    </div>
  )
}
