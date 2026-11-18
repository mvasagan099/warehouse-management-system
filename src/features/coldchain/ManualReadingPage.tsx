import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, CheckCircle2, Minus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Card, PageHeader } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, formatTemperatureRange } from '../../lib/format'
import { isNetworkError } from '../../lib/offline/queue'
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue'
import { supabase } from '../../lib/supabase'
import { useWarehouses, useZones } from '../shared/queries'

/** Mobile-first manual temperature entry: the fallback while sensors are not installed. It feeds alerts and reports like any sensor. */
export function ManualReadingPage() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const offline = useOfflineQueue()
  const whs = useWarehouses()
  const zones = useZones()
  const list = (zones.data ?? []).filter((z) => z.is_active)
  const [zoneId, setZoneId] = useState('')
  const [value, setValue] = useState('')
  const [negative, setNegative] = useState(true)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const zone = list.find((z) => z.id === zoneId)
  const num = value.trim() === '' ? null : Number(`${negative ? '-' : ''}${value.replace(/^-/, '')}`)
  const valid = num !== null && Number.isFinite(num) && num >= -60 && num <= 80
  const outside = zone && num !== null && valid && ((zone.temp_max !== null && num > zone.temp_max) || (zone.temp_min !== null && num < zone.temp_min))
  const whName = useMemo(() => new Map((whs.data ?? []).map((w) => [w.id, w.code])), [whs.data])

  const recent = useQuery({
    queryKey: ['manual_recent', zoneId], enabled: !!zoneId,
    queryFn: async () => {
      const s = await supabase.from('sensors').select('id').eq('zone_id', zoneId).eq('is_manual', true).maybeSingle()
      if (!s.data) return []
      const { data, error } = await supabase.from('readings').select('recorded_at, value, note').eq('sensor_id', s.data.id).order('recorded_at', { ascending: false }).limit(5)
      if (error) throw error
      return data
    },
  })
  const save = useMutation({
    mutationFn: async () => {
      const queue = async () => { await offline.enqueue('manual_reading', `${zone?.code ?? ''} ${num} °C`, { zone_id: zoneId, value: num, note: note.trim() || null }); toast.info(photo ? t('offline.savedNoPhoto') : t('offline.savedOnPhone')); return 'queued' as const }
      if (!navigator.onLine) return await queue()
      let path: string | undefined
      if (photo && zone) {
        path = `${zone.warehouse_id}/readings/${crypto.randomUUID()}-${photo.name.replace(/[^A-Za-z0-9._-]+/g, '-')}`
        const up = await supabase.storage.from('coldchain').upload(path, photo, { contentType: photo.type || 'image/jpeg' })
        if (up.error) throw up.error
      }
      const { error } = await supabase.rpc('add_manual_reading', { p_zone_id: zoneId, p_value: num!, p_photo_path: path, p_note: note.trim() || undefined })
      if (error) { if (isNetworkError(error)) return await queue(); throw error }
      return 'saved' as const
    },
    onSuccess: (r) => { if (r === 'saved') toast.success(t('cold.readingSaved')); setValue(''); setNote(''); setPhoto(null); void qc.invalidateQueries({ queryKey: ['manual_recent'] }); for (const k of ['cc_overview', 'alerts', 'sensors']) void qc.invalidateQueries({ queryKey: [k] }) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={t('cold.manualTitle')} subtitle={t('cold.manualHelp')} />
      <Card className="space-y-4 p-4">
        <Field label={t('common.zone')} htmlFor="mr-zone">
          <Select id="mr-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="h-12 text-base">
            <option value="">{t('common.select')}</option>
            {list.map((z) => <option key={z.id} value={z.id}>{whName.get(z.warehouse_id)} · {z.code} · {z.name}</option>)}
          </Select>
        </Field>
        {zone && <p className="text-sm text-slate-600">{t('cold.target')}: <b>{formatTemperatureRange(zone.temp_min, zone.temp_max)}</b></p>}
        <Field label={t('cold.temperature')} htmlFor="mr-value" hint={t('cold.minusHelp')}>
          <div className="flex gap-2">
            <Button variant={negative ? 'primary' : 'secondary'} className="h-14 w-14 shrink-0" aria-label={t('cold.toggleMinus')} aria-pressed={negative} onClick={() => setNegative(!negative)} icon={<Minus className="h-5 w-5" />} />
            <Input id="mr-value" inputMode="decimal" autoComplete="off" className="h-14 text-center text-3xl font-semibold" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.0" />
            <div className="flex w-12 items-center text-xl text-slate-500">°C</div>
          </div>
        </Field>
        {num !== null && !valid && <p className="text-sm text-red-600" role="alert">{t('cold.impossibleValue')}</p>}
        {outside && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800" data-testid="manual-outside">{t('cold.outsideRangeWarn')}</p>}
        <Field label={t('cold.photo')} htmlFor="mr-photo" optional>
          <label className="flex h-12 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-600"><Camera className="h-5 w-5" />{photo ? photo.name : t('cold.takePhoto')}
            <input id="mr-photo" data-testid="manual-photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
        </Field>
        <Field label={t('common.notes')} htmlFor="mr-note" optional><Input id="mr-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Button className="h-12 w-full text-base" icon={<CheckCircle2 className="h-5 w-5" />} loading={save.isPending} disabled={!zoneId || !valid} onClick={() => save.mutate()}>{t('cold.saveReading')}</Button>
      </Card>
      {!!recent.data?.length && <Card className="mt-4"><div className="border-b border-slate-200 p-3 text-sm font-semibold">{t('cold.recentManual')}</div>
        <ul className="divide-y divide-slate-100 text-sm">{recent.data.map((r) => <li key={r.recorded_at} className="flex justify-between p-3"><span className="font-medium">{r.value} °C</span><span className="text-slate-500">{formatDateTime(r.recorded_at, i18n.resolvedLanguage)}</span></li>)}</ul></Card>}
    </div>
  )
}
