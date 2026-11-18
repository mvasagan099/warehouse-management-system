import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, LogIn, LogOut, MapPin, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canDecide } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { downloadCsv, toCsv } from '../../lib/csv'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime } from '../../lib/format'
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue'
import { supabase } from '../../lib/supabase'
import type { Attendance, Shift } from '../../lib/types'
import { useWarehouses } from '../shared/queries'
import { getPosition } from './geo'

const istDate = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—')

function useMyAttendance(userId?: string) {
  return useQuery({
    queryKey: ['my_attendance', userId], enabled: !!userId,
    queryFn: async () => { const { data, error } = await supabase.from('attendance').select('*').eq('user_id', userId!).order('work_date', { ascending: false }).limit(31); if (error) throw error; return data as Attendance[] },
  })
}

/** Check in / out from a phone. Works with no signal: the punch is saved on the phone with its real time and sent when the network returns. */
function MyDay() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const q = useOfflineQueue()
  const mine = useMyAttendance(profile?.id)
  const [busy, setBusy] = useState(false)
  const [correcting, setCorrecting] = useState<string | null>(null)
  const today = mine.data?.find((a) => a.work_date === istDate())
  const queuedToday = q.items.filter((i) => i.kind === 'attendance')
  const punch = async (dir: 'IN' | 'OUT') => {
    setBusy(true)
    try {
      const pos = await getPosition()
      const at = new Date().toISOString()
      if (!navigator.onLine) { await q.enqueue('attendance', t(dir === 'IN' ? 'att.checkIn' : 'att.checkOut'), { dir, lat: pos?.lat ?? null, lon: pos?.lon ?? null, at }); toast.info(t('att.savedOffline')); return }
      const args = { p_lat: pos?.lat, p_lon: pos?.lon, p_at: at }
      const { data, error } = dir === 'IN' ? await supabase.rpc('check_in', args) : await supabase.rpc('check_out', args)
      if (error) {
        if (/fetch|network/i.test(error.message)) { await q.enqueue('attendance', t(dir === 'IN' ? 'att.checkIn' : 'att.checkOut'), { dir, lat: pos?.lat ?? null, lon: pos?.lon ?? null, at }); toast.info(t('att.savedOffline')); return }
        throw error
      }
      const r = data as { status: string; gps_ok: boolean | null }
      toast.success(r.gps_ok === false ? t('att.doneOutside') : t('att.done'))
      void qc.invalidateQueries({ queryKey: ['my_attendance'] })
    } catch (e) { toast.error(await errorMessage(e)) } finally { setBusy(false) }
  }
  const lang = i18n.resolvedLanguage
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-xs font-medium uppercase text-slate-500">{t('att.today')} · {formatDate(istDate(), lang)}</div>
          <div className="mt-1 text-lg font-semibold" data-testid="att-today">{today?.check_in_at ? `${t('att.in')} ${hhmm(today.check_in_at)}` : t('att.notIn')}{today?.check_out_at ? ` · ${t('att.out')} ${hhmm(today.check_out_at)}` : ''}</div>
          {today?.gps_ok === false && <div className="mt-1 flex items-center gap-1 text-xs text-amber-700"><MapPin className="h-3 w-3" />{t('att.outsideRadius', { m: today.check_in_distance_m })}</div>}
          {queuedToday.length > 0 && <div className="mt-1 text-xs text-amber-700">{t('att.waitingToSend', { count: queuedToday.length })}</div>}</div>
        <div className="flex gap-2">
          <Button className="min-h-14 min-w-32" icon={<LogIn className="h-5 w-5" />} loading={busy} disabled={!!today?.check_in_at} onClick={() => punch('IN')}>{t('att.checkIn')}</Button>
          <Button variant="secondary" className="min-h-14 min-w-32" icon={<LogOut className="h-5 w-5" />} loading={busy} disabled={!today?.check_in_at || !!today?.check_out_at} onClick={() => punch('OUT')}>{t('att.checkOut')}</Button>
        </div>
      </div>
      <h3 className="mb-2 mt-5 text-sm font-semibold">{t('att.recent')}</h3>
      {mine.isPending ? <Spinner /> : (
        <ul className="divide-y divide-slate-100 text-sm">{(mine.data ?? []).slice(0, 10).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{formatDate(a.work_date, lang)}</span><span>{hhmm(a.check_in_at)} – {hhmm(a.check_out_at)}</span>
            <span className="flex items-center gap-2">{a.correction_status !== 'NONE' && <Badge tone={a.correction_status === 'APPROVED' ? 'green' : a.correction_status === 'REJECTED' ? 'red' : 'amber'}>{t(`att.correction.${a.correction_status}`)}</Badge>}
              <Button size="sm" variant="ghost" onClick={() => setCorrecting(a.work_date)}>{t('att.fix')}</Button></span></li>))}
          {!mine.data?.length && <li className="py-3 text-slate-500">{t('att.noneYet')}</li>}</ul>)}
      <Button size="sm" variant="ghost" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => setCorrecting(istDate(new Date(Date.now() - 86400000)))}>{t('att.requestCorrection')}</Button>
      {correcting && <CorrectionDialog date={correcting} onClose={() => setCorrecting(null)} />}
    </Card>
  )
}

function CorrectionDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [f, setF] = useState({ date, in: '09:00', out: '18:00', reason: '' })
  const save = useMutation({
    mutationFn: async () => {
      const at = (hm: string) => new Date(`${f.date}T${hm}:00+05:30`).toISOString()
      const { error } = await supabase.rpc('request_attendance_correction', { p_work_date: f.date, p_in: at(f.in), p_out: (f.out ? at(f.out) : undefined) as string, p_reason: f.reason })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('att.correctionSent')); void qc.invalidateQueries({ queryKey: ['my_attendance'] }); onClose() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('att.requestCorrection')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} disabled={f.reason.trim().length < 3} onClick={() => save.mutate()}>{t('att.send')}</Button></>}>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <Field label={t('common.date')} htmlFor="ac-d"><Input id="ac-d" type="date" max={istDate()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label={t('att.in')} htmlFor="ac-i"><Input id="ac-i" type="time" value={f.in} onChange={(e) => setF({ ...f, in: e.target.value })} /></Field>
        <Field label={t('att.out')} htmlFor="ac-o"><Input id="ac-o" type="time" value={f.out} onChange={(e) => setF({ ...f, out: e.target.value })} /></Field>
        <Field label={t('att.reason')} htmlFor="ac-r" className="sm:col-span-3"><Textarea id="ac-r" rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

function ManagerView() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const whs = useWarehouses()
  const [wh, setWh] = useState('')
  const warehouseId = wh || whs.data?.[0]?.id || ''
  const [tab, setTab] = useState<'today' | 'corrections' | 'roster' | 'report'>('today')
  const [month, setMonth] = useState(istDate().slice(0, 7))
  const people = useQuery({
    queryKey: ['wh_people', warehouseId], enabled: !!warehouseId,
    queryFn: async () => { const { data, error } = await supabase.from('profiles').select('id, full_name').eq('warehouse_id', warehouseId).eq('role', 'STAFF').eq('is_active', true).order('full_name'); if (error) throw error; return data },
  })
  const nameOf = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p.full_name])), [people.data])
  const att = useQuery({
    queryKey: ['wh_attendance', warehouseId, month], enabled: !!warehouseId,
    queryFn: async () => {
      const from = `${month}-01`; const to = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10)
      const { data, error } = await supabase.from('attendance').select('*').eq('warehouse_id', warehouseId).gte('work_date', from).lte('work_date', to).order('work_date', { ascending: false }); if (error) throw error; return data as Attendance[]
    },
  })
  const shifts = useQuery({ queryKey: ['shifts', warehouseId], enabled: !!warehouseId, queryFn: async () => { const { data, error } = await supabase.from('shifts').select('*').eq('warehouse_id', warehouseId).eq('is_active', true).order('starts_at'); if (error) throw error; return data as Shift[] } })
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => istDate(new Date(Date.now() + i * 86400000))), [])
  const roster = useQuery({
    queryKey: ['roster', warehouseId], enabled: !!warehouseId,
    queryFn: async () => { const { data, error } = await supabase.from('shift_roster').select('*').eq('warehouse_id', warehouseId).gte('work_date', days[0]).lte('work_date', days[6]); if (error) throw error; return data },
  })
  const [newShift, setNewShift] = useState({ name: '', starts: '08:00', ends: '16:00' })
  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => { const { error } = await supabase.rpc('decide_attendance_correction', { p_attendance_id: id, p_approve: approve }); if (error) throw error },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['wh_attendance'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const addShift = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('shifts').insert({ warehouse_id: warehouseId, name: newShift.name.trim(), starts_at: newShift.starts, ends_at: newShift.ends }); if (error) throw error },
    onSuccess: () => { setNewShift({ name: '', starts: '08:00', ends: '16:00' }); void shifts.refetch() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const assign = useMutation({
    mutationFn: async ({ userId, day, shiftId }: { userId: string; day: string; shiftId: string }) => {
      const del = await supabase.from('shift_roster').delete().eq('user_id', userId).eq('work_date', day); if (del.error) throw del.error
      if (shiftId) { const { error } = await supabase.from('shift_roster').insert({ warehouse_id: warehouseId, user_id: userId, work_date: day, shift_id: shiftId }); if (error) throw error }
    },
    onSuccess: () => void roster.refetch(), onError: async (e) => toast.error(await errorMessage(e)),
  })
  const report = async () => {
    const from = `${month}-01`; const to = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10)
    const { data, error } = await supabase.rpc('attendance_report', { p_warehouse_id: warehouseId, p_from: from, p_to: to })
    if (error) return toast.error(await errorMessage(error))
    downloadCsv(`attendance-${month}.csv`, toCsv([
      { key: 'employee_code', label: 'Employee' }, { key: 'full_name', label: 'Name' }, { key: 'job_role', label: 'Role' }, { key: 'work_date', label: 'Date' },
      { key: 'check_in', label: 'Check in' }, { key: 'check_out', label: 'Check out' }, { key: 'hours', label: 'Hours' }, { key: 'gps_ok', label: 'At warehouse' }, { key: 'correction_status', label: 'Correction' },
    ], data.map((r) => ({ ...r, check_in: r.check_in_at ? formatDateTime(r.check_in_at, 'en') : '', check_out: r.check_out_at ? formatDateTime(r.check_out_at, 'en') : '', gps_ok: r.gps_ok === null ? '' : r.gps_ok ? 'Yes' : 'No' }))))
  }
  const todayRows = (att.data ?? []).filter((a) => a.work_date === istDate())
  const pending = (att.data ?? []).filter((a) => a.correction_status === 'PENDING')
  const tabs = ['today', 'corrections', 'roster', 'report'] as const
  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select aria-label={t('common.warehouse')} value={warehouseId} onChange={(e) => setWh(e.target.value)} className="sm:w-56">{(whs.data ?? []).filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select>
        <Input aria-label={t('att.month')} type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="sm:w-44" />
      </div>
      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">{tabs.map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500'}`}>{t(`att.tab.${k}`)}{k === 'corrections' && pending.length ? ` (${pending.length})` : ''}</button>)}</div>
      {tab === 'today' && <Card><ul className="divide-y divide-slate-100 text-sm">{todayRows.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 p-3"><span className="font-medium">{nameOf.get(a.user_id) ?? '—'}</span><span>{hhmm(a.check_in_at)} – {hhmm(a.check_out_at)}</span>{a.gps_ok === false && <Badge tone="amber">{t('att.outsideShort')}</Badge>}</li>)}{!todayRows.length && <li className="p-4 text-slate-500">{t('att.nobodyYet')}</li>}</ul></Card>}
      {tab === 'corrections' && <Card><ul className="divide-y divide-slate-100 text-sm">{pending.map((a) => <li key={a.id} className="space-y-1 p-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{nameOf.get(a.user_id) ?? '—'} · {formatDate(a.work_date, lang)}</span><span>{hhmm(a.correction_in)} – {hhmm(a.correction_out)}</span></div><div className="text-slate-600">{a.correction_reason}</div>
        {canDecide('WAREHOUSE_MANAGER') && <div className="flex gap-2"><Button size="sm" onClick={() => decide.mutate({ id: a.id, approve: true })}>{t('common.approve')}</Button><Button size="sm" variant="secondary" onClick={() => decide.mutate({ id: a.id, approve: false })}>{t('common.reject')}</Button></div>}</li>)}{!pending.length && <li className="p-4 text-slate-500">{t('att.noCorrections')}</li>}</ul></Card>}
      {tab === 'roster' && (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-2"><Field label={t('att.shiftName')} htmlFor="sh-n"><Input id="sh-n" value={newShift.name} onChange={(e) => setNewShift({ ...newShift, name: e.target.value })} /></Field>
            <Field label={t('att.starts')} htmlFor="sh-s"><Input id="sh-s" type="time" value={newShift.starts} onChange={(e) => setNewShift({ ...newShift, starts: e.target.value })} /></Field>
            <Field label={t('att.ends')} htmlFor="sh-e"><Input id="sh-e" type="time" value={newShift.ends} onChange={(e) => setNewShift({ ...newShift, ends: e.target.value })} /></Field>
            <Button size="sm" disabled={!newShift.name.trim()} loading={addShift.isPending} onClick={() => addShift.mutate()}>{t('att.addShift')}</Button></div>
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-2 py-1">{t('common.name')}</th>{days.map((d) => <th key={d} className="px-2 py-1">{formatDate(d, lang)}</th>)}</tr></thead>
            <tbody>{(people.data ?? []).map((p) => <tr key={p.id}><td className="px-2 py-1 font-medium">{p.full_name}</td>{days.map((d) => {
              const cur = roster.data?.find((r) => r.user_id === p.id && r.work_date === d)
              return <td key={d} className="px-1 py-1"><Select aria-label={`${p.full_name} ${d}`} value={cur?.shift_id ?? ''} onChange={(e) => assign.mutate({ userId: p.id, day: d, shiftId: e.target.value })} className="py-1"><option value="">—</option>{(shifts.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></td>
            })}</tr>)}</tbody></table></div>
        </Card>)}
      {tab === 'report' && <Card className="p-4"><p className="mb-3 text-sm text-slate-600">{t('att.reportHelp')}</p><Button icon={<Download className="h-4 w-4" />} onClick={report}>{t('att.downloadCsv')}</Button></Card>}
    </div>
  )
}

export function AttendancePage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const isMgr = profile?.role === 'SUPER_ADMIN' || profile?.role === 'WAREHOUSE_MANAGER'
  return (
    <div>
      <PageHeader title={t('att.title')} subtitle={t('att.subtitle')} />
      {profile?.role !== 'SUPER_ADMIN' && <MyDay />}
      {isMgr && <ManagerView />}
    </div>
  )
}
