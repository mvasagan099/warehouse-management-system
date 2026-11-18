import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select } from '../../components/ui/Field'
import { Card, PageHeader } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatTemperatureRange } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { useWarehouses, useZones } from '../shared/queries'

const FIELDS = [
  ['tolerance_deg', 'cold.rule.tolerance', 'deg'], ['delay_min', 'cold.rule.delay', 'min'], ['critical_deviation_deg', 'cold.rule.criticalDeviation', 'deg'], ['critical_after_min', 'cold.rule.criticalAfter', 'min'],
  ['recovery_min', 'cold.rule.recovery', 'min'], ['offline_after_min', 'cold.rule.offlineAfter', 'min'], ['door_open_after_min', 'cold.rule.doorOpen', 'min'], ['humidity_min', 'cold.rule.humidityMin', '%'],
  ['humidity_max', 'cold.rule.humidityMax', '%'], ['humidity_delay_min', 'cold.rule.humidityDelay', 'min'], ['battery_low_pct', 'cold.rule.battery', '%'], ['calibration_warn_days', 'cold.rule.calWarn', 'days'], ['critical_ack_min', 'cold.rule.ackMin', 'min'],
] as const
type FieldKey = (typeof FIELDS)[number][0]

export function RulesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const edit = canWrite(profile?.role, 'alertRules')
  const whs = useWarehouses()
  const zones = useZones()
  const [zoneId, setZoneId] = useState('')
  const zone = zones.data?.find((z) => z.id === zoneId)
  const defaults = useQuery({ queryKey: ['cc_defaults'], queryFn: async () => ((await supabase.from('app_settings').select('value').eq('key', 'coldchain').maybeSingle()).data?.value as { defaults?: Record<string, number> } | undefined)?.defaults ?? {} })
  const rule = useQuery({ queryKey: ['alert_rule', zoneId], enabled: !!zoneId, queryFn: async () => (await supabase.from('alert_rules').select('*').eq('zone_id', zoneId).maybeSingle()).data })
  const windows = useQuery({ queryKey: ['defrost', zoneId], enabled: !!zoneId, queryFn: async () => { const { data, error } = await supabase.from('defrost_windows').select('*').eq('zone_id', zoneId).order('start_time'); if (error) throw error; return data } })
  const [f, setF] = useState<Record<string, string>>({})
  const [enabled, setEnabled] = useState(true)
  useEffect(() => {
    const r = rule.data as Record<string, unknown> | null | undefined
    const next: Record<string, string> = { min_temp: r?.min_temp != null ? String(r.min_temp) : '', max_temp: r?.max_temp != null ? String(r.max_temp) : '' }
    for (const [k] of FIELDS) next[k] = r?.[k] != null ? String(r[k]) : ''
    setF(next); setEnabled(r?.enabled !== false)
  }, [rule.data, zoneId])
  const num = (v: string) => (v.trim() === '' ? null : Number(v))
  const valid = Object.values(f).every((v) => v.trim() === '' || Number.isFinite(Number(v)))
  const save = useMutation({
    mutationFn: async () => {
      const row: Record<string, unknown> = { zone_id: zoneId, enabled, min_temp: num(f.min_temp), max_temp: num(f.max_temp) }
      for (const [k] of FIELDS) row[k] = num(f[k])
      const { error } = rule.data ? await supabase.from('alert_rules').update(row as never).eq('zone_id', zoneId) : await supabase.from('alert_rules').insert(row as never)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['alert_rule'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const [w, setW] = useState({ name: 'Defrost', start: '06:00', end: '07:00' })
  const addWindow = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('defrost_windows').insert({ zone_id: zoneId, name: w.name.trim() || 'Defrost', start_time: w.start, end_time: w.end } as never); if (error) throw error },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['defrost'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const delWindow = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('defrost_windows').delete().eq('id', id); if (error) throw error },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['defrost'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const wh = new Map((whs.data ?? []).map((x) => [x.id, x.code]))
  return (
    <div>
      <PageHeader title={t('cold.rulesTitle')} subtitle={t('cold.rulesHelp')} />
      {!edit && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t('common.readOnly')}</p>}
      <Card className="p-4">
        <Field label={t('common.zone')} htmlFor="ar-zone"><Select id="ar-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}><option value="">{t('common.select')}</option>
          {(zones.data ?? []).filter((z) => z.is_active).map((z) => <option key={z.id} value={z.id}>{wh.get(z.warehouse_id)} · {z.code} · {z.name}</option>)}</Select></Field>
        {zone && <>
          <p className="mt-3 text-sm text-slate-600">{t('cold.zoneRange')}: <b>{formatTemperatureRange(zone.temp_min, zone.temp_max)}</b>. {t('cold.rulesDefaultNote')}</p>
          <div className="mt-3"><Checkbox label={t('cold.rule.enabled')} checked={enabled} disabled={!edit} onChange={(e) => setEnabled(e.target.checked)} /></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(['min_temp', 'max_temp'] as const).map((k) => <Field key={k} label={t(k === 'min_temp' ? 'cold.rule.minTemp' : 'cold.rule.maxTemp')} htmlFor={`ar-${k}`} hint={t('cold.rule.fromZone')}>
              <Input id={`ar-${k}`} inputMode="decimal" disabled={!edit} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={String((k === 'min_temp' ? zone.temp_min : zone.temp_max) ?? '')} /></Field>)}
            {FIELDS.map(([k, label, unit]) => <Field key={k} label={`${t(label)} (${unit})`} htmlFor={`ar-${k}`}>
              <Input id={`ar-${k}`} inputMode="decimal" disabled={!edit} value={f[k as FieldKey] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={defaults.data?.[k] !== undefined ? `${t('cold.default')} ${defaults.data[k]}` : t('cold.rule.off')} /></Field>)}
          </div>
          {edit && <div className="mt-4 flex justify-end"><Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>{t('common.save')}</Button></div>}
          <h2 className="mb-1 mt-6 font-semibold">{t('cold.defrostTitle')}</h2><p className="mb-2 text-xs text-slate-500">{t('cold.defrostHelp')}</p>
          <ul className="space-y-1 text-sm">{(windows.data ?? []).map((x) => <li key={x.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span>{x.name}: {x.start_time.slice(0, 5)} – {x.end_time.slice(0, 5)} IST</span>
            {edit && <Button size="sm" variant="ghost" aria-label={t('common.remove')} icon={<Trash2 className="h-4 w-4" />} onClick={() => delWindow.mutate(x.id)} />}</li>)}
            {!windows.data?.length && <li className="text-slate-500">{t('cold.noDefrost')}</li>}</ul>
          {edit && <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label={t('common.name')} htmlFor="df-name"><Input id="df-name" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} /></Field>
            <Field label={t('cold.from')} htmlFor="df-start"><Input id="df-start" type="time" value={w.start} onChange={(e) => setW({ ...w, start: e.target.value })} /></Field>
            <Field label={t('cold.to')} htmlFor="df-end"><Input id="df-end" type="time" value={w.end} onChange={(e) => setW({ ...w, end: e.target.value })} /></Field>
            <Button variant="secondary" icon={<Plus className="h-4 w-4" />} loading={addWindow.isPending} disabled={w.start === w.end} onClick={() => addWindow.mutate()}>{t('cold.addWindow')}</Button></div>}
        </>}
      </Card>
    </div>
  )
}
