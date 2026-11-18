import { Link } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/Field'
import { Card, EmptyState, ErrorState, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { formatDateTime, formatNumber, formatTemperatureRange } from '../../lib/format'
import type { Alert } from '../../lib/types'
import { useWarehouses } from '../shared/queries'
import { AlertDetail, AlertRows } from './AlertsView'
import { STATUS_STYLE, ageText, sparkPath, tileStatus, type OverviewRow } from './common'
import { useAlerts, useColdChainRealtime, useNow, useOverview, useSensors, useWarehouseChoice } from './queries'

function Spark({ spark, dot }: { spark: OverviewRow['spark']; dot: string }) {
  const pts = (spark ?? []).map((p) => ({ t: Date.parse(p.t), v: p.v }))
  if (pts.length < 2) return <div className="flex h-8 items-center text-[11px] text-slate-400">—</div>
  return (
    <svg viewBox="0 0 120 32" className="h-8 w-full" role="img" aria-label="24 h">
      <path d={sparkPath(pts, 120, 32, 90 * 60_000)} fill="none" stroke={dot} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function Tile({ r, now }: { r: OverviewRow; now: number }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const status = tileStatus(r, now)
  const st = STATUS_STYLE[status]
  const hasValue = r.current_value !== null && status !== 'NO_SENSOR'
  return (
    <Link to={`/cold-chain/zones/${r.zone_id}`} data-testid={`tile-${r.zone_code}`} data-status={status}
      className={`block rounded-xl border-2 bg-white p-3 shadow-sm transition hover:shadow-md ${st.ring}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="truncate font-semibold">{r.zone_code} · {r.zone_name}</div>
          <div className="text-xs text-slate-500">{t('cold.target')}: {formatTemperatureRange(r.temp_min, r.temp_max)}</div></div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${st.chip}`} data-testid="tile-status">
          {status === 'OFFLINE' ? <WifiOff className="h-3 w-3" /> : status === 'NO_SENSOR' ? null : <Wifi className="h-3 w-3" />}{t(`cold.status.${status}`)}</span>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div className={`text-3xl font-semibold tabular-nums ${status === 'OFFLINE' ? 'text-slate-400' : ''}`} data-testid="tile-value">{hasValue ? `${formatNumber(r.current_value, lang, 1)} °C` : t('cold.noData')}</div>
        {r.open_alerts > 0 && <span className="text-xs font-medium text-red-600">{t('cold.openAlerts', { count: r.open_alerts })}</span>}
      </div>
      <Spark spark={r.spark} dot={st.dot} />
      <div className="mt-1 text-[11px] text-slate-500" data-testid="tile-updated">
        {r.last_at ? <>{t('cold.updated')} {formatDateTime(r.last_at, lang)} · {ageText(r.last_at, now)} {t('cold.ago')}{status === 'OFFLINE' ? ` · ${t('cold.staleWarning')}` : ''}</> : t('cold.neverReported')}
      </div>
    </Link>
  )
}

export function LiveDashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const whs = useWarehouses()
  const list = (whs.data ?? []).filter((w) => w.is_active)
  const [wh, setWh] = useWarehouseChoice(list.map((w) => w.id))
  useColdChainRealtime()
  const now = useNow(30_000)
  const overview = useOverview(wh)
  const open = useAlerts({ warehouseId: wh, open: true })
  const sensors = useSensors(wh)
  const [selected, setSelected] = useState<Alert | null>(null)
  const offlineAfter = useMemo(() => new Map((overview.data ?? []).map((z) => [z.zone_id, z.offline_after_min])), [overview.data])
  const attention = useMemo(() => (sensors.data ?? []).filter((s) => s.status !== 'RETIRED' && !s.is_manual).flatMap((s) => {
    const out: { id: string; name: string; why: string }[] = []
    if (s.last_seen_at === null) out.push({ id: s.id + 'n', name: s.name, why: t('cold.neverReported') })
    else if (now - Date.parse(s.last_seen_at) > (offlineAfter.get(s.zone_id) ?? 15) * 60_000) out.push({ id: s.id + 'o', name: s.name, why: `${t('cold.offline')} · ${t('cold.lastSeen')} ${formatDateTime(s.last_seen_at, lang)}` })
    if (s.calibration_due_at && Date.parse(s.calibration_due_at) - now < 7 * 86_400_000) out.push({ id: s.id + 'c', name: s.name, why: `${t('cold.calibrationDue')} ${s.calibration_due_at}` })
    return out
  }), [sensors.data, offlineAfter, now, t, lang])

  return (
    <div>
      <PageHeader title={t('cold.liveTitle')} subtitle={t('cold.liveSubtitle')} actions={
        <Select aria-label={t('common.warehouse')} value={wh ?? ''} onChange={(e) => setWh(e.target.value)} className="min-w-52">
          {list.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
        </Select>} />
      {whs.isPending || overview.isPending ? <div className="flex justify-center p-10"><Spinner /></div>
        : overview.error ? <ErrorState message={t('common.error')} onRetry={() => overview.refetch()} retryLabel={t('common.retry')} />
        : !overview.data?.length ? <EmptyState message={t('cold.noZones')} />
        : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="zone-tiles">{overview.data.map((r) => <Tile key={r.zone_id} r={r} now={now} />)}</div>}
      <p className="mt-2 text-xs text-slate-500">{t('cold.gapNote')}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><div className="border-b border-slate-200 p-3 font-semibold">{t('cold.openAlertsTitle')}</div>
          {open.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : <AlertRows alerts={open.data ?? []} onOpen={setSelected} />}</Card>
        <Card><div className="border-b border-slate-200 p-3 font-semibold">{t('cold.needsAttention')}</div>
          {attention.length === 0 ? <p className="p-4 text-sm text-slate-500">{t('cold.allSensorsOk')}</p>
            : <ul className="divide-y divide-slate-100 text-sm">{attention.map((x) => <li key={x.id} className="p-3"><div className="font-medium">{x.name}</div><div className="text-xs text-slate-500">{x.why}</div></li>)}</ul>}</Card>
      </div>
      {selected && <AlertDetail alertId={selected.id} onClose={() => setSelected(null)} />}
    </div>
  )
}
