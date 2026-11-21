import { useQuery } from '@tanstack/react-query'
import { Download, FileDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Card, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { downloadText, toCsv } from '../billing/common'
import { downloadClientTempReportPdf, downloadRegisterPdf } from '../pdf/download'
import { useClients, useWarehouses, useZones } from '../shared/queries'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const istToday = () => iso(new Date(Date.now() + 5.5 * 3600_000))
const istDaysAgo = (n: number) => iso(new Date(Date.now() + 5.5 * 3600_000 - n * 86_400_000))
const ist = (v: string | null) => (v ? new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '')
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`)

function Period({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  const { t } = useTranslation()
  return <>
    <Field label={t('billing.periodFrom')} htmlFor="cr-from"><Input id="cr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
    <Field label={t('billing.periodTo')} htmlFor="cr-to"><Input id="cr-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></>
}

/** Client temperature report: min, max, average and time out of range for exactly the zones and days that client's stock was there. */
function ClientTemperature() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const clients = useClients()
  const [clientId, setClientId] = useState('')
  const [from, setFrom] = useState(istDaysAgo(30))
  const [to, setTo] = useState(istToday())
  const [run, setRun] = useState<{ client: string; from: string; to: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (isClient && clients.data?.length && !clientId) setClientId(clients.data[0].id) }, [isClient, clients.data, clientId])
  const report = useQuery({
    queryKey: ['client_temp_report', run], enabled: !!run,
    queryFn: async () => {
      const [p, l] = await Promise.all([supabase.rpc('client_temperature_report', { p_client_id: run!.client, p_from: run!.from, p_to: run!.to }), supabase.rpc('client_lorry_temps', { p_client_id: run!.client, p_from: run!.from, p_to: run!.to })])
      if (p.error) throw p.error
      if (l.error) throw l.error
      return { periods: p.data, lorry: l.data }
    },
  })
  const client = clients.data?.find((c) => c.id === run?.client)
  const pdf = async () => {
    if (!client || !report.data || !run) return
    setBusy(true)
    try { await downloadClientTempReportPdf({ client, from: run.from, to: run.to, generatedAt: new Date().toISOString(), periods: report.data.periods, lorry: report.data.lorry }) }
    catch (e) { toast.error(await errorMessage(e)) } finally { setBusy(false) }
  }
  const csv = () => report.data && downloadText(`temperature-report-${client?.code ?? 'client'}-${run!.from}-${run!.to}.csv`, toCsv(['Zone', 'Allowed min C', 'Allowed max C', 'Slots', 'Brigades', 'From', 'To', 'Min C', 'Max C', 'Avg C', 'Readings', 'Minutes out of range', 'Minutes covered', 'Minutes in period'],
    report.data.periods.map((p) => [`${p.zone_code} ${p.zone_name}`, p.temp_min, p.temp_max, p.slots.join(' '), p.brigades, p.from_date, p.to_date, p.min_c, p.max_c, p.avg_c, p.readings, p.minutes_out, p.minutes_covered, p.minutes_period])))
  return (
    <div className="space-y-4">
      <Card className="p-4"><div className="flex flex-wrap items-end gap-3">
        {!isClient && <Field label={t('common.client')} htmlFor="cr-client"><Select id="cr-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="min-w-56"><option value="">{t('common.select')}</option>{(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</Select></Field>}
        <Period from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <Button disabled={!clientId || !from || !to || to < from} onClick={() => setRun({ client: clientId, from, to })}>{t('cold.runReport')}</Button>
        {report.data && <><Button variant="secondary" icon={<FileDown className="h-4 w-4" />} loading={busy} onClick={pdf}>{t('common.downloadPdf')}</Button><Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={csv}>CSV</Button></>}
      </div><p className="mt-2 text-xs text-slate-500">{t('cold.clientReportHelp')}</p></Card>
      {run && (report.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : report.error ? <p className="text-sm text-red-600">{t('common.error')}</p> : <>
        <Card><div className="border-b border-slate-200 p-3 font-semibold">{t('cold.zonesAndTemps')}</div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm" data-testid="client-report"><thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2">{t('common.zone')}</th><th className="px-3 py-2">{t('cold.stockThere')}</th><th className="px-3 py-2 text-right">Min</th><th className="px-3 py-2 text-right">Max</th><th className="px-3 py-2 text-right">Avg</th><th className="px-3 py-2 text-right">{t('cold.outOfRange')}</th><th className="px-3 py-2 text-right">{t('cold.coverage')}</th></tr></thead>
            <tbody>{report.data!.periods.map((p, i) => <tr key={i} className="border-t border-slate-100"><td className="px-3 py-2 font-medium">{p.zone_code} · {p.zone_name}<div className="text-xs font-normal text-slate-500">{p.temp_min}…{p.temp_max} °C</div></td>
              <td className="px-3 py-2 text-xs">{formatDate(p.from_date, lang)} – {formatDate(p.to_date, lang)}<div className="text-slate-500">{p.brigades} · {p.slots.join(', ')}</div></td>
              <td className="px-3 py-2 text-right">{p.min_c ?? '—'}</td><td className="px-3 py-2 text-right">{p.max_c ?? '—'}</td><td className="px-3 py-2 text-right">{p.avg_c ?? '—'}</td><td className="px-3 py-2 text-right font-medium">{mins(p.minutes_out)}</td>
              <td className="px-3 py-2 text-right">{p.minutes_period > 0 ? Math.round((p.minutes_covered / p.minutes_period) * 100) : 0}%</td></tr>)}
              {!report.data!.periods.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">{t('cold.noStockPeriod')}</td></tr>}</tbody></table></div></Card>
        <Card><div className="border-b border-slate-200 p-3 font-semibold">{t('cold.lorryTemps')}</div>
          <table className="min-w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2">{t('billing.document')}</th><th className="px-3 py-2">{t('common.date')}</th><th className="px-3 py-2">{t('gate.lorryNumber')}</th><th className="px-3 py-2 text-right">°C</th></tr></thead>
            <tbody>{report.data!.lorry.map((l) => <tr key={l.doc_no} className="border-t border-slate-100"><td className="px-3 py-2">{l.doc_no} <span className="text-xs text-slate-500">({l.doc_type === 'INWARD_RECEIPT' ? t('cold.arrival') : t('cold.dispatch')})</span></td><td className="px-3 py-2">{formatDateTime(l.at, lang)}</td><td className="px-3 py-2">{l.lorry_number ?? '—'}</td><td className="px-3 py-2 text-right">{l.temp_c ?? '—'}</td></tr>)}
              {!report.data!.lorry.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">{t('cold.noLorry')}</td></tr>}</tbody></table></Card></>)}
    </div>
  )
}

/** Alerts in a period with duration, peak, cause, action and the affected clients and batches. */
function Excursions({ register }: { register: boolean }) {
  const { t } = useTranslation()
  const whs = useWarehouses(); const zones = useZones()
  const [wh, setWh] = useState('')
  const [from, setFrom] = useState(istDaysAgo(30)); const [to, setTo] = useState(istToday())
  const data = useQuery({
    queryKey: ['excursions', wh, from, to],
    queryFn: async () => {
      let q = supabase.from('alerts').select('*').gte('event_start', new Date(`${from}T00:00:00+05:30`).toISOString()).lt('event_start', new Date(Date.parse(`${to}T00:00:00+05:30`) + 86_400_000).toISOString()).order('event_start')
      if (wh) q = q.eq('warehouse_id', wh)
      if (!register) q = q.in('kind', ['TEMP_HIGH', 'TEMP_LOW'])
      const { data: alerts, error } = await q
      if (error) throw error
      const stock = alerts?.length ? (await supabase.from('alert_stock').select('alert_id, client_name, batch_no').in('alert_id', alerts.map((a) => a.id))).data ?? [] : []
      return { alerts: alerts ?? [], stock }
    },
  })
  const zone = useMemo(() => new Map((zones.data ?? []).map((z) => [z.id, z.code])), [zones.data])
  const rows = (data.data?.alerts ?? []).map((a) => {
    const st = (data.data?.stock ?? []).filter((s) => s.alert_id === a.id)
    return { a, clients: [...new Set(st.map((s) => s.client_name))].join('; '), batches: [...new Set(st.map((s) => s.batch_no).filter(Boolean))].join('; ') }
  })
  const head = ['Start (IST)', 'Zone', 'Kind', 'Severity', 'Duration min', 'Peak C', 'Cause', 'Action', 'Clients', 'Batches', 'Status']
  const table = rows.map(({ a, clients, batches }) => [ist(a.event_start), zone.get(a.zone_id) ?? '', a.kind, a.severity, a.duration_min, a.peak_value ?? '', a.cause ?? '', a.action_taken ?? '', clients, batches, a.status])
  return (
    <div className="space-y-4">
      <Card className="p-4"><div className="flex flex-wrap items-end gap-3">
        <Field label={t('common.warehouse')} htmlFor="ex-wh"><Select id="ex-wh" value={wh} onChange={(e) => setWh(e.target.value)} className="min-w-48"><option value="">{t('common.all')}</option>{(whs.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select></Field>
        <Period from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <Button variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!rows.length} onClick={() => downloadText(`${register ? 'alert-register' : 'excursions'}-${from}-${to}.csv`, toCsv(head, table))}>CSV</Button>
        <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} disabled={!rows.length} onClick={() => downloadRegisterPdf({ title: register ? 'ALERT REGISTER' : 'EXCURSION REPORT', subtitle: `${from} to ${to}`, columns: [{ h: 'Start (IST)', w: '12%' }, { h: 'Zone', w: '5%' }, { h: 'Kind', w: '9%' }, { h: 'Sev', w: '7%' }, { h: 'Min', w: '5%', right: true }, { h: 'Peak', w: '5%', right: true }, { h: 'Cause', w: '14%' }, { h: 'Action', w: '14%' }, { h: 'Clients', w: '15%' }, { h: 'Batches', w: '9%' }, { h: 'Status', w: '5%' }], rows: table.map((r) => r.map(String)) }, register ? 'alert-register' : 'excursion-report')}>{t('common.downloadPdf')}</Button>
      </div></Card>
      <Card>{data.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : <div className="overflow-x-auto"><table className="min-w-full text-sm" data-testid="excursion-table"><thead className="text-left text-xs text-slate-500"><tr>{head.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>{table.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((c, j) => <td key={j} className="px-3 py-2">{String(c)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={head.length} className="px-3 py-6 text-center text-slate-500">{t('cold.noAlerts')}</td></tr>}</tbody></table></div>}</Card>
    </div>
  )
}

/** Daily temperature log sheet for a zone (food-safety audits): hourly min, max and average with a signature line. */
function DailyLog() {
  const { t } = useTranslation()
  const zones = useZones(); const whs = useWarehouses()
  const [zoneId, setZoneId] = useState(''); const [date, setDate] = useState(istToday())
  const from = new Date(`${date}T00:00:00+05:30`)
  const series = useQuery({ queryKey: ['daily_log', zoneId, date], enabled: !!zoneId, queryFn: async () => { const { data, error } = await supabase.rpc('zone_series', { p_zone_id: zoneId, p_from: from.toISOString(), p_to: new Date(from.getTime() + 86_400_000).toISOString(), p_bucket_min: 60 }); if (error) throw error; return data } })
  const zone = zones.data?.find((z) => z.id === zoneId); const wh = whs.data?.find((w) => w.id === zone?.warehouse_id)
  const rows = Array.from({ length: 24 }, (_, h) => { const hit = (series.data ?? []).find((r) => new Date(r.bucket).getTime() === from.getTime() + h * 3600_000); return [`${String(h).padStart(2, '0')}:00`, hit?.min_v ?? 'no data', hit?.max_v ?? 'no data', hit?.avg_v ?? 'no data', hit?.n ?? 0] })
  return (
    <div className="space-y-4">
      <Card className="p-4"><div className="flex flex-wrap items-end gap-3">
        <Field label={t('common.zone')} htmlFor="dl-zone"><Select id="dl-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="min-w-56"><option value="">{t('common.select')}</option>{(zones.data ?? []).filter((z) => z.is_active).map((z) => <option key={z.id} value={z.id}>{z.code} · {z.name}</option>)}</Select></Field>
        <Field label={t('common.date')} htmlFor="dl-date"><Input id="dl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} disabled={!zoneId || !series.data} onClick={() => downloadRegisterPdf({ title: 'DAILY TEMPERATURE LOG', subtitle: `${wh?.name ?? ''} · zone ${zone?.code} ${zone?.name} · ${date} · allowed ${zone?.temp_min ?? '-'} to ${zone?.temp_max ?? '-'} C`, columns: [{ h: 'Hour (IST)', w: '20%' }, { h: 'Min C', w: '20%', right: true }, { h: 'Max C', w: '20%', right: true }, { h: 'Average C', w: '20%', right: true }, { h: 'Readings', w: '20%', right: true }], rows: rows.map((r) => r.map(String)), signature: true }, `daily-log-${zone?.code}-${date}`)}>{t('common.downloadPdf')}</Button>
        <Button variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!series.data} onClick={() => downloadText(`daily-log-${zone?.code}-${date}.csv`, toCsv(['Hour', 'Min C', 'Max C', 'Avg C', 'Readings'], rows))}>CSV</Button>
      </div></Card>
      {zoneId && <Card><table className="min-w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2">{t('cold.hour')}</th><th className="px-3 py-2 text-right">Min</th><th className="px-3 py-2 text-right">Max</th><th className="px-3 py-2 text-right">Avg</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={String(r[0])} className="border-t border-slate-100"><td className="px-3 py-1.5">{r[0]}</td>{[1, 2, 3].map((i) => <td key={i} className={`px-3 py-1.5 text-right ${r[i] === 'no data' ? 'text-slate-400' : ''}`}>{r[i] === 'no data' ? t('cold.noData') : String(r[i])}</td>)}</tr>)}</tbody></table></Card>}
    </div>
  )
}

function CalibrationRegister() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const data = useQuery({ queryKey: ['cal_register'], queryFn: async () => {
    const [s, c, z] = await Promise.all([supabase.from('sensors').select('*').is('deleted_at', null).eq('is_manual', false).order('name'), supabase.from('calibration_log').select('*').order('calibrated_on', { ascending: false }), supabase.from('zones').select('id, code')])
    return { sensors: s.data ?? [], log: c.data ?? [], zones: new Map((z.data ?? []).map((x) => [x.id, x.code])) }
  } })
  const rows = (data.data?.sensors ?? []).map((s) => { const last = data.data?.log.find((c) => c.sensor_id === s.id); return [s.name, data.data?.zones.get(s.zone_id) ?? '', s.serial_no, s.last_calibrated_at ?? '', s.calibration_due_at ?? '', `${s.calibration_offset}`, last ? `${last.reference_value} / ${last.sensor_value}` : '', last?.certificate_path ? 'yes' : 'no'] })
  const head = ['Sensor', 'Zone', 'Serial', 'Last calibrated', 'Due', 'Offset C', 'Reference / sensor', 'Certificate']
  return (
    <div className="space-y-4"><Card className="p-4"><div className="flex gap-2">
      <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => downloadText('calibration-register.csv', toCsv(head, rows))}>CSV</Button>
      <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} onClick={() => downloadRegisterPdf({ title: 'CALIBRATION REGISTER', columns: [{ h: 'Sensor', w: '18%' }, { h: 'Zone', w: '8%' }, { h: 'Serial', w: '14%' }, { h: 'Last calibrated', w: '13%' }, { h: 'Due', w: '11%' }, { h: 'Offset C', w: '9%', right: true }, { h: 'Reference / sensor', w: '17%' }, { h: 'Cert', w: '10%' }], rows: rows.map((r) => r.map(String)), signature: true }, 'calibration-register')}>{t('common.downloadPdf')}</Button></div></Card>
      <Card><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr>{head.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((c, j) => <td key={j} className="px-3 py-2">{j === 3 || j === 4 ? (c ? formatDate(String(c), lang) : '—') : String(c)}</td>)}</tr>)}</tbody></table></div></Card></div>
  )
}

export function ColdReportsPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const tabs = (isClient ? ['client'] : ['client', 'excursions', 'daily', 'calibration', 'alerts']) as ('client' | 'excursions' | 'daily' | 'calibration' | 'alerts')[]
  const [tab, setTab] = useState<(typeof tabs)[number]>('client')
  return (
    <div>
      <PageHeader title={t('cold.reportsTitle')} />
      {tabs.length > 1 && <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">{tabs.map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500'}`}>{t(`cold.reportTab.${k}`)}</button>)}</div>}
      {tab === 'client' && <ClientTemperature />}
      {tab === 'excursions' && <Excursions register={false} />}
      {tab === 'daily' && <DailyLog />}
      {tab === 'calibration' && <CalibrationRegister />}
      {tab === 'alerts' && <Excursions register />}
    </div>
  )
}
