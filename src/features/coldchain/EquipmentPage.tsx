import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Equipment, EquipmentType, MaintenanceTask, TaskStatus } from '../../lib/types'
import { useWarehouses, useZones } from '../shared/queries'
import { useEquipment } from './queries'

const TYPES: EquipmentType[] = ['CHILLER', 'COMPRESSOR', 'GENERATOR', 'FORKLIFT', 'RACK', 'OTHER']
const TASK_TONE: Record<TaskStatus, 'gray' | 'blue' | 'green' | 'red'> = { OPEN: 'gray', IN_PROGRESS: 'blue', DONE: 'green', CANCELLED: 'red' }

function EquipmentForm({ item, onClose }: { item: Equipment | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const whs = useWarehouses(); const zones = useZones()
  const [f, setF] = useState({ warehouse_id: item?.warehouse_id ?? '', zone_id: item?.zone_id ?? '', type: (item?.type ?? 'CHILLER') as EquipmentType, name: item?.name ?? '', code: item?.code ?? '', vendor: item?.vendor ?? '', vendor_phone: item?.vendor_phone ?? '',
    warranty_end: item?.warranty_end ?? '', interval: item?.service_interval_days?.toString() ?? '', notes: item?.notes ?? '' })
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const save = useMutation({
    mutationFn: async () => {
      const row = { warehouse_id: f.warehouse_id, zone_id: f.zone_id || null, type: f.type, name: f.name.trim(), code: f.code.trim() || null, vendor: f.vendor.trim() || null, vendor_phone: f.vendor_phone.trim() || null,
        warranty_end: f.warranty_end || null, service_interval_days: f.interval ? Math.trunc(Number(f.interval)) : null, notes: f.notes.trim() || null }
      const { error } = item ? await supabase.from('equipment').update(row).eq('id', item.id) : await supabase.from('equipment').insert(row)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['equipment'] }); onClose() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={item ? t('cold.editEquipment') : t('cold.addEquipment')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={!f.warehouse_id || !f.name.trim()} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label={t('common.warehouse')} htmlFor="eq-wh"><Select id="eq-wh" value={f.warehouse_id} onChange={(e) => set('warehouse_id', e.target.value)}><option value="">{t('common.select')}</option>{(whs.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select></Field>
        <Field label={t('common.zone')} htmlFor="eq-zone" optional><Select id="eq-zone" value={f.zone_id} onChange={(e) => set('zone_id', e.target.value)}><option value="">—</option>{(zones.data ?? []).filter((z) => z.warehouse_id === f.warehouse_id).map((z) => <option key={z.id} value={z.id}>{z.code} · {z.name}</option>)}</Select></Field>
        <Field label={t('common.name')} htmlFor="eq-name"><Input id="eq-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={t('cold.equipType')} htmlFor="eq-type"><Select id="eq-type" value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((x) => <option key={x} value={x}>{t(`cold.equipTypes.${x}`)}</option>)}</Select></Field>
        <Field label={t('common.code')} htmlFor="eq-code" optional><Input id="eq-code" value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label={t('cold.vendor')} htmlFor="eq-vendor" optional><Input id="eq-vendor" value={f.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
        <Field label={t('cold.vendorPhone')} htmlFor="eq-vp" optional><Input id="eq-vp" value={f.vendor_phone} onChange={(e) => set('vendor_phone', e.target.value)} /></Field>
        <Field label={t('cold.warrantyEnd')} htmlFor="eq-war" optional><Input id="eq-war" type="date" value={f.warranty_end} onChange={(e) => set('warranty_end', e.target.value)} /></Field>
        <Field label={t('cold.serviceInterval')} htmlFor="eq-int" optional hint={t('cold.serviceIntervalHelp')}><Input id="eq-int" type="number" min={1} value={f.interval} onChange={(e) => set('interval', e.target.value)} /></Field>
        <Field label={t('common.notes')} htmlFor="eq-notes" optional className="col-span-2"><Textarea id="eq-notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function TaskForm({ equipment, onClose }: { equipment: Equipment[]; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const people = useQuery({ queryKey: ['assignees'], queryFn: async () => { const { data, error } = await supabase.from('profiles').select('id, full_name, role').in('role', ['STAFF', 'WAREHOUSE_MANAGER']).is('deleted_at', null).order('full_name'); if (error) throw error; return data } })
  const [f, setF] = useState({ equipment_id: '', title: 'Service', due_date: new Date().toISOString().slice(0, 10), assigned_to: '' })
  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('maintenance_tasks').insert({ equipment_id: f.equipment_id, title: f.title.trim() || 'Service', due_date: f.due_date, assigned_to: f.assigned_to || null } as never); if (error) throw error },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['maintenance'] }); onClose() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('cold.addTask')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} disabled={!f.equipment_id || !f.due_date} onClick={() => save.mutate()}>{t('common.create')}</Button></>}>
      <div className="grid gap-3 text-sm">
        <Field label={t('cold.equipment')} htmlFor="tk-eq"><Select id="tk-eq" value={f.equipment_id} onChange={(e) => setF({ ...f, equipment_id: e.target.value })}><option value="">{t('common.select')}</option>{equipment.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</Select></Field>
        <Field label={t('cold.taskTitle')} htmlFor="tk-title"><Input id="tk-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={t('cold.dueDate')} htmlFor="tk-due"><Input id="tk-due" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
        <Field label={t('cold.assignedTo')} htmlFor="tk-as" optional><Select id="tk-as" value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })}><option value="">—</option>{(people.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Select></Field>
      </div>
    </Modal>
  )
}

function CompleteDialog({ task, onClose }: { task: MaintenanceTask; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [notes, setNotes] = useState(task.notes ?? '')
  const [files, setFiles] = useState<File[]>([])
  const save = useMutation({
    mutationFn: async () => {
      const paths: string[] = []
      for (const file of files) { const p = `${task.warehouse_id}/maintenance/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, '-')}`; const up = await supabase.storage.from('coldchain').upload(p, file, { contentType: file.type }); if (up.error) throw up.error; paths.push(p) }
      const { error } = await supabase.rpc('complete_maintenance_task', { p_task_id: task.id, p_notes: notes.trim() || undefined, p_photos: paths.length ? paths : undefined })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('cold.taskDone')); void qc.invalidateQueries({ queryKey: ['maintenance'] }); void qc.invalidateQueries({ queryKey: ['equipment'] }); onClose() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('cold.completeTask')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{t('cold.markDone')}</Button></>}>
      <div className="space-y-3 text-sm"><Field label={t('common.notes')} htmlFor="ct-notes"><Textarea id="ct-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Field label={t('cold.photos')} htmlFor="ct-photos" optional><input id="ct-photos" type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFiles([...(e.target.files ?? [])])} className="block w-full text-sm" /></Field></div>
    </Modal>
  )
}

export function EquipmentPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const { profile } = useAuth()
  const manage = canWrite(profile?.role, 'equipment') || profile?.role === 'WAREHOUSE_MANAGER'
  const equipment = useEquipment()
  const tasks = useQuery({ queryKey: ['maintenance'], queryFn: async () => { const { data, error } = await supabase.from('maintenance_tasks').select('*').order('due_date'); if (error) throw error; return data } })
  const [tab, setTab] = useState<'equipment' | 'tasks'>('tasks')
  const [form, setForm] = useState<{ item: Equipment | null } | null>(null)
  const [adding, setAdding] = useState(false)
  const [completing, setCompleting] = useState<MaintenanceTask | null>(null)
  const [history, setHistory] = useState<Equipment | null>(null)
  const eqName = new Map((equipment.data ?? []).map((q) => [q.id, q.name]))
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => { const { error } = await supabase.rpc('update_maintenance_task', { p_task_id: id, p_status: status }); if (error) throw error },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['maintenance'] }), onError: async (e) => toast.error(await errorMessage(e)),
  })
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
  return (
    <div>
      <PageHeader title={t('cold.equipmentTitle')} actions={manage && <>{tab === 'equipment' ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ item: null })}>{t('cold.addEquipment')}</Button> : <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>{t('cold.addTask')}</Button>}</>} />
      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">{(['tasks', 'equipment'] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500'}`}>{t(`cold.tab.${k}`)}</button>)}</div>
      {tab === 'tasks' ? (
        <Card>{tasks.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : !tasks.data?.length ? <p className="p-4 text-sm text-slate-500">{t('cold.noTasks')}</p> : (
          <ul className="divide-y divide-slate-100 text-sm">{tasks.data.map((k) => (
            <li key={k.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="task-row">
              <div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{eqName.get(k.equipment_id)} · {k.title}</span><Badge tone={TASK_TONE[k.status]}>{t(`cold.taskStatus.${k.status}`)}</Badge>
                {k.alert_id && <Badge tone="amber">{t('cold.fromAlert')}</Badge>}{k.status !== 'DONE' && k.status !== 'CANCELLED' && k.due_date < today && <Badge tone="red">{t('cold.overdue')}</Badge>}</div>
                <div className="text-xs text-slate-500">{t('cold.dueDate')}: {formatDate(k.due_date, lang)}{k.notes ? ` · ${k.notes}` : ''}</div></div>
              {k.status !== 'DONE' && k.status !== 'CANCELLED' && <div className="flex gap-2">
                {k.status === 'OPEN' && <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: k.id, status: 'IN_PROGRESS' })}>{t('cold.startTask')}</Button>}
                <Button size="sm" onClick={() => setCompleting(k)}>{t('cold.markDone')}</Button></div>}
            </li>))}</ul>)}</Card>
      ) : (
        <Card>{equipment.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : (
          <table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="px-3 py-2">{t('common.name')}</th><th className="px-3 py-2">{t('cold.equipType')}</th><th className="px-3 py-2">{t('cold.vendor')}</th><th className="px-3 py-2">{t('cold.warrantyEnd')}</th><th className="px-3 py-2">{t('cold.lastService')}</th><th className="px-3 py-2">{t('cold.nextService')}</th><th /></tr></thead>
            <tbody>{(equipment.data ?? []).map((q) => <tr key={q.id}><td className="px-3 py-2 font-medium">{q.name}</td><td className="px-3 py-2">{t(`cold.equipTypes.${q.type}`)}</td><td className="px-3 py-2">{q.vendor ?? '—'}</td><td className="px-3 py-2">{q.warranty_end ? formatDate(q.warranty_end, lang) : '—'}</td>
              <td className="px-3 py-2">{q.last_service_on ? formatDate(q.last_service_on, lang) : '—'}</td><td className="px-3 py-2">{q.next_service_due ? formatDate(q.next_service_due, lang) : '—'}</td>
              <td className="whitespace-nowrap px-3 py-2"><Button size="sm" variant="ghost" onClick={() => setHistory(q)}>{t('cold.history')}</Button>{manage && <Button size="sm" variant="ghost" onClick={() => setForm({ item: q })}>{t('common.edit')}</Button>}</td></tr>)}
              {!equipment.data?.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">{t('cold.noEquipment')}</td></tr>}</tbody></table>)}</Card>
      )}
      {form && <EquipmentForm item={form.item} onClose={() => setForm(null)} />}
      {adding && <TaskForm equipment={equipment.data ?? []} onClose={() => setAdding(false)} />}
      {completing && <CompleteDialog task={completing} onClose={() => setCompleting(null)} />}
      {history && <Modal open title={`${t('cold.history')} · ${history.name}`} onClose={() => setHistory(null)}>
        <ul className="space-y-1 text-sm">{(tasks.data ?? []).filter((k) => k.equipment_id === history.id).map((k) => <li key={k.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span>{k.title} · {t(`cold.taskStatus.${k.status}`)}</span><span className="text-slate-500">{k.completed_at ? formatDate(k.completed_at, lang) : formatDate(k.due_date, lang)}</span></li>)}</ul></Modal>}
    </div>
  )
}
