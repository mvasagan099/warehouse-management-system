import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Card, ErrorState, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { formatDateTime, formatTemperatureRange } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { downloadText, toCsv } from '../billing/common'
import { useZones } from '../shared/queries'
import { RANGE_PRESETS, ageText, breakAtGaps, bucketMinutes, doorIntervals } from './common'
import { useColdChainRealtime, useNow } from './queries'

const toLocalInput = (ms: number) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000); return d.toISOString().slice(0, 16) }
const timeLabel = (ms: number, long: boolean) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...(long ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false } : { hour: '2-digit', minute: '2-digit', hour12: false }) }).format(ms)

export function ZoneDetail() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const zones = useZones()
  const zone = zones.data?.find((z) => z.id === id)
  useColdChainRealtime()
  const now = useNow(60_000)
  const [preset, setPreset] = useState<string>('24h')
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [anchor] = useState(() => Date.now())
  const to = custom ? Date.parse(custom.to) : Math.floor(now / 60_000) * 60_000 + 60_000
  const from = custom ? Date.parse(custom.from) : to - (RANGE_PRESETS.find((p) => p.key === preset)?.ms ?? 86_400_000)
  const valid = Number.isFinite(from) && Number.isFinite(to) && to > from
  const bucket = valid ? bucketMinutes(to - from) : 15

  const series = useQuery({
    queryKey: ['cc_series', id, from, to, bucket], enabled: !!id && valid,
    queryFn: async () => { const { data, error } = await supabase.rpc('zone_series', { p_zone_id: id, p_from: new Date(from).toISOString(), p_to: new Date(to).toISOString(), p_bucket_min: bucket }); if (error) throw error; return data },
  })
  const events = useQuery({
    queryKey: ['cc_events', id, from, to], enabled: !!id && valid,
    queryFn: async () => {
      const [alerts, doors] = await Promise.all([
        supabase.from('alerts').select('*').eq('zone_id', id).lte('event_start', new Date(to).toISOString()).order('event_start'),
        supabase.from('sensors').select('id').eq('zone_id', id).eq('type', 'DOOR').is('deleted_at', null),
      ])
      if (alerts.error) throw alerts.error
      const ids = (doors.data ?? []).map((d) => d.id)
      let door: { t: number; v: number }[] = []
      if (ids.length) {
        const r = await supabase.from('readings').select('recorded_at, value').in('sensor_id', ids).gte('recorded_at', new Date(from).toISOString()).lt('recorded_at', new Date(to).toISOString()).order('recorded_at').limit(5000)
        door = (r.data ?? []).map((x) => ({ t: Date.parse(x.recorded_at), v: x.value }))
      }
      return { alerts: (alerts.data ?? []).filter((a) => !a.recovered_at || Date.parse(a.recovered_at) >= from), doors: doorIntervals(door, to) }
    },
  })

  const gapMs = Math.max(15, bucket * 3) * 60_000
  const data = useMemo(() => {
    const rows = (series.data ?? []).map((r) => ({ t: Date.parse(r.bucket), avg: r.avg_v, min: r.min_v, max: r.max_v, n: r.n }))
    const out: { t: number; avg: number | null; min: number | null; max: number | null }[] = []
    rows.forEach((r, i) => { if (i > 0 && r.t - rows[i - 1].t > gapMs) out.push({ t: rows[i - 1].t + gapMs / 2, avg: null, min: null, max: null }); out.push(r) })
    return out
  }, [series.data, gapMs])
  void breakAtGaps
  const exportCsv = () => downloadText(`zone-${zone?.code ?? id}-${new Date(from).toISOString().slice(0, 10)}.csv`, toCsv(['Bucket start (IST)', 'Min C', 'Max C', 'Average C', 'Readings'],
    (series.data ?? []).map((r) => [new Date(Date.parse(r.bucket)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), r.min_v, r.max_v, r.avg_v, r.n])))

  return (
    <div>
      <PageHeader title={zone ? `${zone.code} · ${zone.name}` : t('cold.zone')} subtitle={zone ? `${t('cold.target')}: ${formatTemperatureRange(zone.temp_min, zone.temp_max)}` : undefined}
        actions={<><Link to="/cold-chain" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><ArrowLeft className="h-4 w-4" />{t('common.back')}</Link>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!series.data?.length} onClick={exportCsv}>CSV</Button></>} />
      <Card className="p-3">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          {RANGE_PRESETS.map((p) => <Button key={p.key} size="sm" variant={!custom && preset === p.key ? 'primary' : 'secondary'} onClick={() => { setCustom(null); setPreset(p.key) }}>{p.key}</Button>)}
          <Field label={t('billing.periodFrom')} htmlFor="zd-from" className="ml-2"><Input id="zd-from" type="datetime-local" value={toLocalInput(from)} onChange={(e) => setCustom({ from: e.target.value, to: custom?.to ?? toLocalInput(to) })} /></Field>
          <Field label={t('billing.periodTo')} htmlFor="zd-to"><Input id="zd-to" type="datetime-local" value={toLocalInput(to)} onChange={(e) => setCustom({ from: custom?.from ?? toLocalInput(from), to: e.target.value })} /></Field>
        </div>
        {!valid ? <p className="p-4 text-sm text-red-600">{t('cold.badRange')}</p> : series.isPending ? <div className="flex h-72 items-center justify-center"><Spinner /></div>
          : series.error ? <ErrorState message={t('common.error')} onRetry={() => series.refetch()} retryLabel={t('common.retry')} />
          : data.length === 0 ? <p className="p-8 text-center text-sm text-slate-500" data-testid="no-data">{t('cold.noDataRange')}</p> : (
            <div className="h-80 w-full" data-testid="zone-chart">
              <ResponsiveContainer>
                <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="t" type="number" scale="time" domain={[from, to]} tickFormatter={(v) => timeLabel(v, to - from > 36 * 3600_000)} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="°" domain={['auto', 'auto']} width={44} />
                  {zone && zone.temp_min !== null && zone.temp_max !== null && <ReferenceArea y1={zone.temp_min} y2={zone.temp_max} fill="#10b981" fillOpacity={0.12} ifOverflow="extendDomain" />}
                  {(events.data?.doors ?? []).map((d, i) => <ReferenceArea key={`d${i}`} x1={Math.max(d.from, from)} x2={Math.min(d.to, to)} fill="#38bdf8" fillOpacity={0.18} />)}
                  <Line dataKey="max" stroke="#fca5a5" strokeWidth={1} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="min" stroke="#93c5fd" strokeWidth={1} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="avg" stroke="#0e7490" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                  {(events.data?.alerts ?? []).filter((a) => a.peak_value !== null && Date.parse(a.event_start) >= from).map((a) =>
                    <ReferenceDot key={a.id} x={Date.parse(a.event_start)} y={a.peak_value as number} r={5} fill={a.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'} stroke="#fff" />)}
                  <Tooltip labelFormatter={(v) => formatDateTime(new Date(v as number), i18n.resolvedLanguage)} formatter={(v) => (v === null ? t('cold.noData') : `${v} °C`)} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>)}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-emerald-300" />{t('cold.legendBand')}</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-sky-300" />{t('cold.legendDoor')}</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />{t('cold.legendAlert')}</span>
          <span>{t('cold.gapNote')}</span>
          <span className="ml-auto" data-testid="chart-updated">{t('cold.updated')} {series.dataUpdatedAt ? `${formatDateTime(new Date(series.dataUpdatedAt), i18n.resolvedLanguage)} · ${ageText(new Date(series.dataUpdatedAt).toISOString(), now || anchor)} ${t('cold.ago')}` : '—'}</span>
        </div>
      </Card>
      {!!events.data?.alerts.length && <Card className="mt-4"><div className="border-b border-slate-200 p-3 font-semibold">{t('cold.alertsInRange')}</div>
        <ul className="divide-y divide-slate-100 text-sm">{events.data.alerts.map((a) => <li key={a.id} className="flex justify-between gap-2 p-3"><span>{t(`cold.kind.${a.kind}`)} · {t(`cold.severity.${a.severity}`)}</span><span className="text-slate-500">{formatDateTime(a.event_start, i18n.resolvedLanguage)} · {a.duration_min} min</span></li>)}</ul></Card>}
    </div>
  )
}
