import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants } from '../../lib/types'
import { QuickCompany } from '../gate/QuickAdd'
import { useClients, useCompanies, useWarehouses } from '../shared/queries'

interface Line { key: string; item_name: string; quantity: string; unit: string; batch_no: string; expiry_date: string; required_temp_c: string; storage_type: string }
const blank = (): Line => ({ key: crypto.randomUUID(), item_name: '', quantity: '', unit: 'BOX', batch_no: '', expiry_date: '', required_temp_c: '', storage_type: 'FROZEN' })
const TONE = { ADVISED: 'blue', ARRIVED: 'green', CANCELLED: 'gray' } as const
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)

function NewAdvice({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const whs = useWarehouses()
  const clients = useClients()
  const [f, setF] = useState({ client: isClient ? (profile?.client_id ?? '') : '', warehouse: '', date: today(), company: '', lorry: '', driver: '', phone: '', remarks: '' })
  const [lines, setLines] = useState<Line[]>([blank()])
  const [addingCompany, setAddingCompany] = useState(false)
  const active = (whs.data ?? []).filter((w) => w.is_active)
  const warehouse = f.warehouse || (active.length === 1 ? active[0].id : '')
  const companies = useCompanies(f.client)
  const setLine = (k: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)))
  const valid = !!warehouse && !!f.client && lines.every((l) => l.item_name.trim() && Number(l.quantity) > 0)
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('create_inward_advice', {
        p_warehouse_id: warehouse, p_expected: f.date, p_company_id: (f.company || null) as unknown as string, p_lorry: f.lorry, p_driver_name: f.driver, p_driver_phone: f.phone, p_remarks: f.remarks,
        p_client_id: isClient ? undefined : f.client,
        p_lines: lines.map((l) => ({ item_name: l.item_name, quantity: Number(l.quantity), unit: l.unit, batch_no: l.batch_no, expiry_date: l.expiry_date, required_temp_c: l.required_temp_c === '' ? null : Number(l.required_temp_c), storage_type: l.storage_type })) as never,
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('advice.sent')); void qc.invalidateQueries({ queryKey: ['advices'] }); onClose() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open size="lg" title={t('advice.new')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>{t('advice.send')}</Button></>}>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {!isClient && <Field label={t('common.client')} htmlFor="av-client"><Select id="av-client" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value, company: '' })}><option value="">{t('common.select')}</option>{(clients.data ?? []).filter((c) => c.status === 'ACTIVE').map((c) => <option key={c.id} value={c.id}>{c.code} · {c.company_name}</option>)}</Select></Field>}
          {active.length > 1 && <Field label={t('common.warehouse')} htmlFor="av-wh"><Select id="av-wh" value={warehouse} onChange={(e) => setF({ ...f, warehouse: e.target.value })}><option value="">{t('common.select')}</option>{active.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select></Field>}
          <Field label={t('advice.expectedDate')} htmlFor="av-date"><Input id="av-date" type="date" min={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label={t('gate.fromCompany')} htmlFor="av-co" optional><Select id="av-co" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })}><option value="">—</option>{(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            {f.client && <button type="button" className="mt-1 text-sm font-medium text-brand-700 hover:underline" onClick={() => setAddingCompany(true)}>+ {t('gate.newCompany')}</button>}</Field>
          <Field label={t('gate.lorryNumber')} htmlFor="av-lorry" optional hint={t('advice.lorryHint')}><Input id="av-lorry" className="uppercase" value={f.lorry} onChange={(e) => setF({ ...f, lorry: e.target.value })} /></Field>
          <Field label={t('gate.driverName')} htmlFor="av-driver" optional><Input id="av-driver" value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })} /></Field>
          <Field label={t('common.phone')} htmlFor="av-phone" optional><Input id="av-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="font-medium">{t('advice.goods')}</div>
          {lines.map((l, i) => (
            <div key={l.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
              <Input aria-label={`${t('common.item')} ${i + 1}`} placeholder={t('common.item')} value={l.item_name} onChange={(e) => setLine(l.key, { item_name: e.target.value })} className="col-span-2 sm:col-span-1" />
              <Input aria-label={t('common.quantity')} placeholder={t('common.quantity')} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
              <Input aria-label={t('common.unit')} placeholder="BOX" value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} />
              <Input aria-label="°C" placeholder="°C" inputMode="decimal" value={l.required_temp_c} onChange={(e) => setLine(l.key, { required_temp_c: e.target.value })} />
              <Select aria-label={t('zones.storageType')} value={l.storage_type} onChange={(e) => setLine(l.key, { storage_type: e.target.value })}>{Constants.public.Enums.storage_type.map((s) => <option key={s} value={s}>{t(`storageType.${s}`)}</option>)}</Select>
              <Button variant="ghost" size="sm" aria-label={t('common.remove')} disabled={lines.length === 1} icon={<Trash2 className="h-4 w-4" />} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
              <Input aria-label={t('common.batch')} placeholder={t('common.batch')} value={l.batch_no} onChange={(e) => setLine(l.key, { batch_no: e.target.value })} className="col-span-2 sm:col-span-2" />
              <Input aria-label={t('common.expiry')} type="date" value={l.expiry_date} onChange={(e) => setLine(l.key, { expiry_date: e.target.value })} className="col-span-2 sm:col-span-2" />
            </div>))}
          <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setLines((ls) => [...ls, blank()])}>{t('dispatch.addItem')}</Button>
        </div>
        <Field label={t('common.notes')} htmlFor="av-notes" optional><Textarea id="av-notes" rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
      </div>
      {addingCompany && f.client && <QuickCompany clientId={f.client} onClose={() => setAddingCompany(false)} onCreated={(id) => { setF({ ...f, company: id }); setAddingCompany(false) }} />}
    </Modal>
  )
}

/** Clients tell the warehouse what is coming; staff see it as "expected" and tap Arrived when the lorry is at the gate. */
export function AdvicePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const clients = useClients()
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [lorryFor, setLorryFor] = useState<{ id: string; lorry: string } | null>(null)
  const list = useQuery({
    queryKey: ['advices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inward_advices').select('*').order('expected_date', { ascending: true }).limit(300); if (error) throw error
      const ids = data.map((a) => a.id)
      const { data: lines } = ids.length ? await supabase.from('inward_advice_lines').select('*').in('advice_id', ids).order('line_no') : { data: [] }
      return data.map((a) => ({ ...a, lines: (lines ?? []).filter((l) => l.advice_id === a.id) }))
    },
  })
  const arrive = useMutation({
    mutationFn: async ({ id, lorry }: { id: string; lorry?: string }) => { const { data, error } = await supabase.rpc('mark_advice_arrived', { p_advice_id: id, p_lorry: lorry }); if (error) throw error; return data as string },
    onSuccess: (gateId) => { toast.success(t('advice.arrivedDone')); void qc.invalidateQueries({ queryKey: ['advices'] }); void qc.invalidateQueries({ queryKey: ['gate_entries'] }); navigate(`/gate/${gateId}`) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const cancel = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc('cancel_inward_advice', { p_advice_id: id }); if (error) throw error },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['advices'] }), onError: async (e) => toast.error(await errorMessage(e)),
  })
  const name = new Map((clients.data ?? []).map((c) => [c.id, c.company_name]))
  const rows = (list.data ?? []).filter((a) => filter === 'all' || a.status === 'ADVISED')
  return (
    <div>
      <PageHeader title={t('advice.title')} subtitle={t(isClient ? 'advice.helpClient' : 'advice.helpStaff')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>{t('advice.new')}</Button>} />
      <div className="mb-3 flex gap-2">{(['open', 'all'] as const).map((k) => <Button key={k} size="sm" variant={filter === k ? 'primary' : 'secondary'} onClick={() => setFilter(k)}>{t(`advice.filter.${k}`)}</Button>)}</div>
      <Card>
        {list.isPending ? <div className="flex justify-center p-8"><Spinner /></div> : list.error ? <ErrorState message={t('common.error')} onRetry={() => list.refetch()} /> : !rows.length ? <EmptyState message={t('advice.none')} /> : (
          <ul className="divide-y divide-slate-100 text-sm">{rows.map((a) => (
            <li key={a.id} className="space-y-2 p-4" data-testid="advice-row">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{a.advice_no}</span>{!isClient && <span className="font-medium">{name.get(a.client_id)}</span>}<Badge tone={TONE[a.status as keyof typeof TONE]}>{t(`advice.status.${a.status}`)}</Badge>
                  <span className="text-slate-600">{t('advice.expected')} {formatDate(a.expected_date, lang)}</span>{a.lorry_number && <span className="font-mono">{a.lorry_number}</span>}</div>
                <div className="flex gap-2">
                  {!isClient && a.status === 'ADVISED' && <Button size="sm" icon={<Truck className="h-4 w-4" />} loading={arrive.isPending} onClick={() => (a.lorry_number ? arrive.mutate({ id: a.id }) : setLorryFor({ id: a.id, lorry: '' }))} data-testid="advice-arrived">{t('advice.arrived')}</Button>}
                  {a.status === 'ADVISED' && <Button size="sm" variant="ghost" onClick={() => cancel.mutate(a.id)}>{t('common.cancel')}</Button>}
                </div>
              </div>
              <ul className="text-slate-600">{a.lines.map((l) => <li key={l.id}>{l.item_name} — {formatNumber(l.quantity, lang, 3)} {l.unit}{l.batch_no ? ` · ${l.batch_no}` : ''}{l.required_temp_c !== null ? ` · ${l.required_temp_c} °C` : ''}</li>)}</ul>
            </li>))}</ul>)}
      </Card>
      {adding && <NewAdvice onClose={() => setAdding(false)} />}
      {lorryFor && (
        <Modal open title={t('advice.lorryNeeded')} onClose={() => setLorryFor(null)} footer={<><Button variant="secondary" onClick={() => setLorryFor(null)}>{t('common.cancel')}</Button><Button loading={arrive.isPending} disabled={lorryFor.lorry.replace(/[^A-Za-z0-9]/g, '').length < 4} onClick={() => arrive.mutate({ id: lorryFor.id, lorry: lorryFor.lorry })}>{t('advice.arrived')}</Button></>}>
          <Field label={t('gate.lorryNumber')} htmlFor="av-l2"><Input id="av-l2" className="h-12 text-base uppercase" value={lorryFor.lorry} onChange={(e) => setLorryFor({ ...lorryFor, lorry: e.target.value })} autoFocus /></Field>
        </Modal>)}
    </div>
  )
}
