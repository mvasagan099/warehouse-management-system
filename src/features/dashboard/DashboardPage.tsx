import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../../auth/AuthProvider'
import { DataTable } from '../../components/ui/DataTable'
import { Select } from '../../components/ui/Field'
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '../../components/ui/misc'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { formatNumber, formatTemperatureRange, percent } from '../../lib/format'
import { Constants, type ZoneSlotSummary } from '../../lib/types'
import { useSlotSummary, useWarehouses } from '../shared/queries'
import { byStorageType, totals } from './summary'

const COLORS = { free: '#10b981', reserved: '#8b5cf6', occupied: '#0e7490', blocked: '#f59e0b' }

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </Card>
  )
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const { profile } = useAuth()
  const summary = useSlotSummary()
  const warehouses = useWarehouses()
  const [warehouseId, setWarehouseId] = useState('')

  const rows = useMemo(
    () => (summary.data ?? []).filter((r) => !warehouseId || r.warehouse_id === warehouseId),
    [summary.data, warehouseId],
  )
  const sum = totals(rows)
  const byType = byStorageType(rows, Constants.public.Enums.storage_type)
  const warehouseCount = warehouseId ? 1 : (warehouses.data?.filter((w) => w.is_active).length ?? 0)

  const columns = useMemo<ColumnDef<ZoneSlotSummary>[]>(
    () => [
      { accessorKey: 'warehouse_name', header: t('common.warehouse') },
      { accessorKey: 'zone_name', header: t('common.zone'), cell: (c) => `${c.row.original.zone_code} · ${c.getValue<string>()}` },
      {
        accessorKey: 'storage_type',
        header: t('zones.storageType'),
        cell: (c) => <Badge tone={c.getValue() === 'DRY' ? 'amber' : 'cyan'}>{t(`storageType.${c.getValue<string>()}`)}</Badge>,
      },
      { id: 'temp', header: t('zones.tempRange'), cell: (c) => formatTemperatureRange(c.row.original.temp_min, c.row.original.temp_max) },
      { accessorKey: 'total_slots', header: t('dashboard.totalSlots') },
      { accessorKey: 'free_slots', header: t('dashboard.free') },
      { accessorKey: 'reserved_slots', header: t('dashboard.reserved') },
      { accessorKey: 'occupied_slots', header: t('dashboard.occupied') },
      { accessorKey: 'blocked_slots', header: t('dashboard.blocked') },
      {
        id: 'util',
        header: t('dashboard.utilisation'),
        cell: (c) => `${percent(c.row.original.occupied_slots ?? 0, c.row.original.total_slots ?? 0)}%`,
      },
    ],
    [t],
  )

  if (summary.isPending) return <FullPageSpinner />
  if (summary.error) return <ErrorState message={t('common.error')} onRetry={() => summary.refetch()} retryLabel={t('common.retry')} />

  const zoneChart = rows.map((r) => ({
    name: `${r.warehouse_code}-${r.zone_code}`,
    [t('dashboard.free')]: r.free_slots,
    [t('dashboard.reserved')]: r.reserved_slots,
    [t('dashboard.occupied')]: r.occupied_slots,
    [t('dashboard.blocked')]: r.blocked_slots,
  }))
  const typeChart = byType.map((r) => ({
    name: t(`storageType.${r.storage_type}`),
    [t('dashboard.free')]: r.free,
    [t('dashboard.reserved')]: r.reserved,
    [t('dashboard.occupied')]: r.occupied,
    [t('dashboard.blocked')]: r.blocked,
  }))

  const bars = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
      <Tooltip />
      <Legend />
      <Bar dataKey={t('dashboard.free')} stackId="a" fill={COLORS.free} />
      <Bar dataKey={t('dashboard.reserved')} stackId="a" fill={COLORS.reserved} />
      <Bar dataKey={t('dashboard.occupied')} stackId="a" fill={COLORS.occupied} />
      <Bar dataKey={t('dashboard.blocked')} stackId="a" fill={COLORS.blocked} />
    </>
  )

  return (
    <div>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={profile ? t(`roles.${profile.role}`) : undefined}
        actions={
          (warehouses.data?.length ?? 0) > 1 && (
            <Select aria-label={t('common.warehouse')} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-56">
              <option value="">{t('dashboard.allWarehouses')}</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
              ))}
            </Select>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label={t('dashboard.warehouses')} value={formatNumber(warehouseCount, lang)} />
        <Stat label={t('dashboard.zones')} value={formatNumber(sum.zones, lang)} />
        <Stat label={t('dashboard.totalSlots')} value={formatNumber(sum.total, lang)} />
        <Stat label={t('dashboard.free')} value={formatNumber(sum.free, lang)} sub={`${percent(sum.free, sum.total)}%`} />
        <Stat label={t('dashboard.reserved')} value={formatNumber(sum.reserved, lang)} sub={`${percent(sum.reserved, sum.total)}%`} />
        <Stat label={t('dashboard.occupied')} value={formatNumber(sum.occupied, lang)} sub={`${percent(sum.occupied, sum.total)}%`} />
        <Stat label={t('dashboard.blocked')} value={formatNumber(sum.blocked, lang)} sub={`${percent(sum.blocked, sum.total)}%`} />
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState message={t('dashboard.empty')} /></Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">{t('dashboard.byZone')}</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={zoneChart}>{bars}</BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">{t('dashboard.byStorageType')}</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeChart}>{bars}</BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card>
            <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{t('dashboard.zoneTable')}</h2>
            <DataTable data={rows} columns={columns} />
          </Card>
        </>
      )}
    </div>
  )
}
