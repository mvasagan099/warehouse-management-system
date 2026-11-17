import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Plus, Replace } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { formatINR, rupeesToPaise } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import type { LabourRate, OtherCharge, RateCard, RentRate, TaxRule } from '../../lib/types'
import { bpToPercent } from '../../lib/words'
import { useBrigadeTypes, useClients, useWarehouses } from '../shared/queries'
import { LABOUR_ACTIVITIES, LABOUR_BASES, STORAGE_TYPES, multiplierLabel, percentToBp } from './common'
import { useClientGroups, useOtherCharges } from './queries'

const todayIso = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
const rup = (v: string) => { try { return rupeesToPaise(v) } catch { return null } }
const bp = (v: string) => { try { return percentToBp(v) } catch { return null } }
const num = (v: string) => (v.trim() === '' ? null : Number(v))
const invalidate = (qc: ReturnType<typeof useQueryClient>) => { for (const k of ['rate_cards', 'rent_rates', 'labour_rates', 'other_charges', 'tax_rules']) void qc.invalidateQueries({ queryKey: [k] }) }

type Tab = 'cards' | 'charges' | 'tax' | 'tester'

// ---------------------------------------------------------------- rate cards ----------------------------------------------------------------
function CardForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const clients = useClients(); const groups = useClientGroups(); const warehouses = useWarehouses()
  const [f, setF] = useState({ name: '', scope: 'CLIENT' as RateCard['scope'], client_id: '', group_id: '', warehouse_id: '', valid_from: todayIso(), valid_to: '', rent: '0', labour: '0', free: '0', min: '0' })
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const rentBp = bp(f.rent); const labBp = bp(f.labour)
  const keyOk = f.scope === 'GLOBAL' || (f.scope === 'CLIENT' && f.client_id) || (f.scope === 'GROUP' && f.group_id) || (f.scope === 'WAREHOUSE' && f.warehouse_id)
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('rate_cards').insert({
        name: f.name.trim(), scope: f.scope, client_id: f.scope === 'CLIENT' ? f.client_id : null, group_id: f.scope === 'GROUP' ? f.group_id : null, warehouse_id: f.scope === 'WAREHOUSE' ? f.warehouse_id : null,
        valid_from: f.valid_from, valid_to: f.valid_to || null, rent_discount_bp: rentBp!, labour_discount_bp: labBp!, free_days: Math.trunc(Number(f.free)), min_billing_days: Math.trunc(Number(f.min)),
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('rates.cardCreated')); invalidate(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('rates.newCard')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={!f.name.trim() || !keyOk || rentBp === null || labBp === null || !f.valid_from} onClick={() => save.mutate()}>{t('common.create')}</Button></>}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label={t('common.name')} htmlFor="rc-name" className="col-span-2"><Input id="rc-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={t('rates.scope')} htmlFor="rc-scope" hint={t('rates.scopeHelp')}><Select id="rc-scope" value={f.scope} onChange={(e) => set('scope', e.target.value)}>{(['CLIENT', 'GROUP', 'WAREHOUSE', 'GLOBAL'] as const).map((s) => <option key={s} value={s}>{t(`rates.scope${s}`)}</option>)}</Select></Field>
        {f.scope === 'CLIENT' && <Field label={t('common.client')} htmlFor="rc-client"><Select id="rc-client" value={f.client_id} onChange={(e) => set('client_id', e.target.value)}><option value="">{t('common.select')}</option>{(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</Select></Field>}
        {f.scope === 'GROUP' && <Field label={t('rates.group')} htmlFor="rc-group"><Select id="rc-group" value={f.group_id} onChange={(e) => set('group_id', e.target.value)}><option value="">{t('common.select')}</option>{(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>}
        {f.scope === 'WAREHOUSE' && <Field label={t('common.warehouse')} htmlFor="rc-wh"><Select id="rc-wh" value={f.warehouse_id} onChange={(e) => set('warehouse_id', e.target.value)}><option value="">{t('common.select')}</option>{(warehouses.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select></Field>}
        <Field label={t('rates.validFrom')} htmlFor="rc-from"><Input id="rc-from" type="date" value={f.valid_from} onChange={(e) => set('valid_from', e.target.value)} /></Field>
        <Field label={t('rates.validTo')} htmlFor="rc-to" optional><Input id="rc-to" type="date" value={f.valid_to} onChange={(e) => set('valid_to', e.target.value)} /></Field>
        <Field label={t('rates.rentDiscount')} htmlFor="rc-rd"><Input id="rc-rd" inputMode="decimal" value={f.rent} onChange={(e) => set('rent', e.target.value)} /></Field>
        <Field label={t('rates.labourDiscount')} htmlFor="rc-ld"><Input id="rc-ld" inputMode="decimal" value={f.labour} onChange={(e) => set('labour', e.target.value)} /></Field>
        <Field label={t('rates.freeDays')} htmlFor="rc-free" hint={t('rates.freeDaysHelp')}><Input id="rc-free" type="number" min={0} value={f.free} onChange={(e) => set('free', e.target.value)} /></Field>
        <Field label={t('rates.minDays')} htmlFor="rc-min" hint={t('rates.minDaysHelp')}><Input id="rc-min" type="number" min={0} value={f.min} onChange={(e) => set('min', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function RentRateForm({ card, replacing, onClose }: { card: RateCard; replacing: RentRate | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const types = useBrigadeTypes()
  const r = replacing
  const [f, setF] = useState({ storage: (r?.storage_type ?? 'FROZEN') as RentRate['storage_type'], tmin: r?.temp_min?.toString() ?? '', tmax: r?.temp_max?.toString() ?? '', bt: r?.brigade_type_id ?? '', basis: (r?.basis ?? 'PER_BRIGADE') as RentRate['basis'],
    rate: r ? (r.rate_paise / 100).toFixed(2) : '', tf: r?.tier_from?.toString() ?? '', tt: r?.tier_to?.toString() ?? '', from: todayIso() > card.valid_from ? todayIso() : card.valid_from })
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const paise = rup(f.rate)
  const bandOk = (f.tmin === '') === (f.tmax === '')
  const save = useMutation({
    mutationFn: async () => {
      if (r) { const { error } = await supabase.from('rent_rates').update({ valid_to: dayBefore(f.from) }).eq('id', r.id); if (error) throw error }
      const { error } = await supabase.from('rent_rates').insert({ rate_card_id: card.id, storage_type: f.storage, temp_min: num(f.tmin), temp_max: num(f.tmax), brigade_type_id: f.bt || null, basis: f.basis, rate_paise: paise!, tier_from: num(f.tf), tier_to: num(f.tt), valid_from: f.from })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('rates.rateSaved')); invalidate(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={r ? t('rates.newVersion') : t('rates.addRentRate')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={paise === null || !bandOk || (r !== null && f.from <= r.valid_from)} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {r && <p className="col-span-2 rounded-lg bg-slate-50 p-2 text-slate-600">{t('rates.versionHelp', { date: formatDate(dayBefore(f.from)) })}</p>}
        <Field label={t('billing.storageType')} htmlFor="rr-st"><Select id="rr-st" value={f.storage} onChange={(e) => set('storage', e.target.value)}>{STORAGE_TYPES.map((s) => <option key={s} value={s}>{t(`storageType.${s}`)}</option>)}</Select></Field>
        <Field label={t('rates.basis')} htmlFor="rr-basis"><Select id="rr-basis" value={f.basis} onChange={(e) => set('basis', e.target.value)}><option value="PER_BRIGADE">{t('rates.perBrigadeDay')}</option><option value="PER_M3">{t('rates.perM3Day')}</option></Select></Field>
        <Field label={t('rates.tempMin')} htmlFor="rr-tmin" optional><Input id="rr-tmin" inputMode="decimal" value={f.tmin} onChange={(e) => set('tmin', e.target.value)} /></Field>
        <Field label={t('rates.tempMax')} htmlFor="rr-tmax" optional><Input id="rr-tmax" inputMode="decimal" value={f.tmax} onChange={(e) => set('tmax', e.target.value)} /></Field>
        <Field label={t('rates.brigadeType')} htmlFor="rr-bt" optional><Select id="rr-bt" value={f.bt} onChange={(e) => set('bt', e.target.value)}><option value="">{t('rates.anyBrigadeType')}</option>{(types.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
        <Field label={t('rates.rateRupees')} htmlFor="rr-rate"><Input id="rr-rate" inputMode="decimal" value={f.rate} onChange={(e) => set('rate', e.target.value)} /></Field>
        <Field label={t('rates.tierFrom')} htmlFor="rr-tf" optional hint={t('rates.tierHelp')}><Input id="rr-tf" type="number" min={1} value={f.tf} onChange={(e) => set('tf', e.target.value)} /></Field>
        <Field label={t('rates.tierTo')} htmlFor="rr-tt" optional><Input id="rr-tt" type="number" min={1} value={f.tt} onChange={(e) => set('tt', e.target.value)} /></Field>
        <Field label={t('rates.validFrom')} htmlFor="rr-from" className="col-span-2"><Input id="rr-from" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function LabourRateForm({ card, replacing, onClose }: { card: RateCard; replacing: LabourRate | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const r = replacing
  const [f, setF] = useState({ activity: (r?.activity ?? 'UNLOADING') as LabourRate['activity'], basis: (r?.basis ?? 'PER_PACKAGE') as LabourRate['basis'], rate: r ? (r.rate_paise / 100).toFixed(2) : '',
    ct: (r?.cold_premium_type ?? 'NONE') as LabourRate['cold_premium_type'], cv: r ? (r.cold_premium_type === 'PERCENT' ? (r.cold_premium_value / 100).toString() : (r.cold_premium_value / 100).toFixed(2)) : '0',
    night: r ? (r.night_multiplier_bp / 10000).toString() : '1', ot: r ? (r.overtime_multiplier_bp / 10000).toString() : '1', from: todayIso() > card.valid_from ? todayIso() : card.valid_from })
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const paise = rup(f.rate)
  const coldValue = f.ct === 'NONE' ? 0 : f.ct === 'PERCENT' ? bp(f.cv) : rup(f.cv)
  const mult = (v: string) => { const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(v.trim()); return m ? Number(m[1]) * 10000 + Number((m[2] ?? '').padEnd(4, '0')) : null }
  const nightBp = mult(f.night); const otBp = mult(f.ot)
  const save = useMutation({
    mutationFn: async () => {
      if (r) { const { error } = await supabase.from('labour_rates').update({ valid_to: dayBefore(f.from) }).eq('id', r.id); if (error) throw error }
      const { error } = await supabase.from('labour_rates').insert({ rate_card_id: card.id, activity: f.activity, basis: f.basis, rate_paise: paise!, cold_premium_type: f.ct, cold_premium_value: coldValue!, night_multiplier_bp: nightBp!, overtime_multiplier_bp: otBp!, valid_from: f.from })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('rates.rateSaved')); invalidate(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={r ? t('rates.newVersion') : t('rates.addLabourRate')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={paise === null || coldValue === null || nightBp === null || otBp === null || (r !== null && f.from <= r.valid_from)} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {r && <p className="col-span-2 rounded-lg bg-slate-50 p-2 text-slate-600">{t('rates.versionHelp', { date: formatDate(dayBefore(f.from)) })}</p>}
        <Field label={t('rates.activity')} htmlFor="lr-act"><Select id="lr-act" value={f.activity} onChange={(e) => set('activity', e.target.value)}>{LABOUR_ACTIVITIES.map((a) => <option key={a} value={a}>{t(`labourActivity.${a}`)}</option>)}</Select></Field>
        <Field label={t('rates.basis')} htmlFor="lr-basis"><Select id="lr-basis" value={f.basis} onChange={(e) => set('basis', e.target.value)}>{LABOUR_BASES.map((b) => <option key={b} value={b}>{t(`labourBasis.${b}`)}</option>)}</Select></Field>
        <Field label={t('rates.rateRupees')} htmlFor="lr-rate"><Input id="lr-rate" inputMode="decimal" value={f.rate} onChange={(e) => set('rate', e.target.value)} /></Field>
        <Field label={t('rates.coldPremium')} htmlFor="lr-ct"><Select id="lr-ct" value={f.ct} onChange={(e) => set('ct', e.target.value)}><option value="NONE">{t('rates.premiumNONE')}</option><option value="PERCENT">{t('rates.premiumPERCENT')}</option><option value="AMOUNT">{t('rates.premiumAMOUNT')}</option></Select></Field>
        {f.ct !== 'NONE' && <Field label={f.ct === 'PERCENT' ? t('rates.premiumPercentValue') : t('rates.premiumAmountValue')} htmlFor="lr-cv"><Input id="lr-cv" inputMode="decimal" value={f.cv} onChange={(e) => set('cv', e.target.value)} /></Field>}
        <Field label={t('rates.nightMultiplier')} htmlFor="lr-night" hint={t('rates.multiplierHelp')}><Input id="lr-night" inputMode="decimal" value={f.night} onChange={(e) => set('night', e.target.value)} /></Field>
        <Field label={t('rates.overtimeMultiplier')} htmlFor="lr-ot"><Input id="lr-ot" inputMode="decimal" value={f.ot} onChange={(e) => set('ot', e.target.value)} /></Field>
        <Field label={t('rates.validFrom')} htmlFor="lr-from" className="col-span-2"><Input id="lr-from" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function CardEditor({ card, editable, onClose }: { card: RateCard; editable: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const rent = useQuery({ queryKey: ['rent_rates', card.id], queryFn: async () => { const { data, error } = await supabase.from('rent_rates').select('*').eq('rate_card_id', card.id).is('deleted_at', null).order('storage_type').order('valid_from', { ascending: false }); if (error) throw error; return data } })
  const labour = useQuery({ queryKey: ['labour_rates', card.id], queryFn: async () => { const { data, error } = await supabase.from('labour_rates').select('*').eq('rate_card_id', card.id).is('deleted_at', null).order('activity').order('valid_from', { ascending: false }); if (error) throw error; return data } })
  const used = useQuery({ queryKey: ['rates_used', card.id], queryFn: async () => {
    const ids = [...(rent.data ?? []), ...(labour.data ?? [])].map((x) => x.id)
    if (!ids.length) return new Set<string>()
    const { data, error } = await supabase.from('invoice_lines').select('rate_ids').overlaps('rate_ids', ids); if (error) throw error
    return new Set((data ?? []).flatMap((l) => l.rate_ids))
  }, enabled: !!rent.data && !!labour.data })
  const [rentForm, setRentForm] = useState<{ replacing: RentRate | null } | null>(null)
  const [labourForm, setLabourForm] = useState<{ replacing: LabourRate | null } | null>(null)
  const today = todayIso()
  const close = useMutation({
    mutationFn: async ({ table, id }: { table: 'rent_rates' | 'labour_rates'; id: string }) => { const { error } = await supabase.from(table).update({ valid_to: dayBefore(today) < card.valid_from ? card.valid_from : dayBefore(today) }).eq('id', id); if (error) throw error },
    onSuccess: () => { toast.success(t('rates.rateClosed')); invalidate(qc) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const status = (r: { valid_from: string; valid_to: string | null }) => r.valid_to && r.valid_to < today ? <Badge>{t('rates.expired')}</Badge> : r.valid_from > today ? <Badge tone="blue">{t('rates.future')}</Badge> : <Badge tone="green">{t('rates.current')}</Badge>
  const usedBadge = (id: string) => used.data?.has(id) ? <span title={t('rates.usedHelp')}><Lock className="inline h-3.5 w-3.5 text-slate-400" aria-label={t('rates.used')} /></span> : null
  const actions = (table: 'rent_rates' | 'labour_rates', r: RentRate | LabourRate) => editable && (!r.valid_to || r.valid_to >= today) && (
    <span className="whitespace-nowrap">
      <Button size="sm" variant="ghost" icon={<Replace className="h-3.5 w-3.5" />} onClick={() => table === 'rent_rates' ? setRentForm({ replacing: r as RentRate }) : setLabourForm({ replacing: r as LabourRate })}>{t('rates.newVersion')}</Button>
      <Button size="sm" variant="ghost" onClick={() => close.mutate({ table, id: r.id })}>{t('rates.closeRate')}</Button>
    </span>)
  return (
    <Modal open size="lg" title={card.name} onClose={onClose}>
      <div className="space-y-5 text-sm">
        <p className="text-slate-600">{t(`rates.scope${card.scope}`)} · {formatDate(card.valid_from)} – {card.valid_to ? formatDate(card.valid_to) : t('rates.open')} · {t('rates.rentDiscount')}: {bpToPercent(card.rent_discount_bp)} · {t('rates.labourDiscount')}: {bpToPercent(card.labour_discount_bp)} · {t('rates.freeDays')}: {card.free_days} · {t('rates.minDays')}: {card.min_billing_days}</p>
        <section>
          <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold">{t('rates.rentRates')}</h3>{editable && <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setRentForm({ replacing: null })}>{t('rates.addRentRate')}</Button>}</div>
          {rent.isPending ? <Spinner /> : <table className="min-w-full text-xs"><thead className="text-left uppercase text-slate-500"><tr><th className="py-1">{t('billing.storageType')}</th><th>{t('rates.tempBand')}</th><th>{t('rates.tier')}</th><th className="text-right">{t('billing.rate')}</th><th>{t('rates.validity')}</th><th /></tr></thead>
            <tbody>{(rent.data ?? []).map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="py-1">{t(`storageType.${r.storage_type}`)}</td><td>{r.temp_min !== null ? `${r.temp_min}…${r.temp_max} °C` : '—'}</td><td>{r.tier_from ? `${r.tier_from}–${r.tier_to ?? '∞'}` : '—'}</td>
              <td className="text-right">{formatINR(r.rate_paise)} / {r.basis === 'PER_M3' ? 'm³' : t('rates.brigade')}</td><td>{formatDate(r.valid_from)} – {r.valid_to ? formatDate(r.valid_to) : t('rates.open')} {status(r)} {usedBadge(r.id)}</td><td>{actions('rent_rates', r)}</td></tr>)}</tbody></table>}
        </section>
        <section>
          <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold">{t('rates.labourRates')}</h3>{editable && <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setLabourForm({ replacing: null })}>{t('rates.addLabourRate')}</Button>}</div>
          {labour.isPending ? <Spinner /> : <table className="min-w-full text-xs"><thead className="text-left uppercase text-slate-500"><tr><th className="py-1">{t('rates.activity')}</th><th>{t('rates.basis')}</th><th className="text-right">{t('billing.rate')}</th><th>{t('rates.coldPremium')}</th><th>{t('rates.night')} / {t('rates.overtime')}</th><th>{t('rates.validity')}</th><th /></tr></thead>
            <tbody>{(labour.data ?? []).map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="py-1">{t(`labourActivity.${r.activity}`)}</td><td>{t(`labourBasis.${r.basis}`)}</td><td className="text-right">{formatINR(r.rate_paise)}</td>
              <td>{r.cold_premium_type === 'NONE' ? '—' : r.cold_premium_type === 'PERCENT' ? bpToPercent(r.cold_premium_value) : formatINR(r.cold_premium_value)}</td><td>{multiplierLabel(r.night_multiplier_bp)} / {multiplierLabel(r.overtime_multiplier_bp)}</td>
              <td>{formatDate(r.valid_from)} – {r.valid_to ? formatDate(r.valid_to) : t('rates.open')} {status(r)} {usedBadge(r.id)}</td><td>{actions('labour_rates', r)}</td></tr>)}</tbody></table>}
        </section>
      </div>
      {rentForm && <RentRateForm card={card} replacing={rentForm.replacing} onClose={() => setRentForm(null)} />}
      {labourForm && <LabourRateForm card={card} replacing={labourForm.replacing} onClose={() => setLabourForm(null)} />}
    </Modal>
  )
}

function CardsTab({ editable }: { editable: boolean }) {
  const { t } = useTranslation()
  const cards = useQuery({ queryKey: ['rate_cards'], queryFn: async () => { const { data, error } = await supabase.from('rate_cards').select('*').is('deleted_at', null).order('scope').order('name'); if (error) throw error; return data } })
  const clients = useClients(); const groups = useClientGroups(); const warehouses = useWarehouses()
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const target = (c: RateCard) => c.scope === 'CLIENT' ? clients.data?.find((x) => x.id === c.client_id)?.company_name : c.scope === 'GROUP' ? groups.data?.find((x) => x.id === c.group_id)?.name : c.scope === 'WAREHOUSE' ? warehouses.data?.find((x) => x.id === c.warehouse_id)?.code : t('rates.everyone')
  const open = cards.data?.find((c) => c.id === openId)
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-200 p-3"><p className="text-sm text-slate-500">{t('rates.cardsHelp')}</p>{editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('rates.newCard')}</Button>}</div>
      {cards.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : (
        <table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">{t('common.name')}</th><th className="px-3 py-2">{t('rates.scope')}</th><th className="px-3 py-2">{t('rates.appliesTo')}</th><th className="px-3 py-2">{t('rates.validity')}</th><th className="px-3 py-2">{t('rates.terms')}</th><th /></tr></thead>
          <tbody>{(cards.data ?? []).map((c) => <tr key={c.id}><td className="px-3 py-2 font-medium">{c.name}</td><td className="px-3 py-2">{t(`rates.scope${c.scope}`)}</td><td className="px-3 py-2">{target(c)}</td>
            <td className="px-3 py-2">{formatDate(c.valid_from)} – {c.valid_to ? formatDate(c.valid_to) : t('rates.open')}</td>
            <td className="px-3 py-2 text-xs text-slate-500">{t('rates.rentDiscount')} {bpToPercent(c.rent_discount_bp)} · {t('rates.labourDiscount')} {bpToPercent(c.labour_discount_bp)} · {c.free_days}/{c.min_billing_days} {t('rates.days')}</td>
            <td className="px-3 py-2"><Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setOpenId(c.id)}>{editable ? t('common.edit') : t('common.view')}</Button></td></tr>)}</tbody></table>)}
      {creating && <CardForm onClose={() => setCreating(false)} />}
      {open && <CardEditor card={open} editable={editable} onClose={() => setOpenId(null)} />}
    </Card>
  )
}

// ---------------------------------------------------------------- other charges ----------------------------------------------------------------
function ChargeForm({ charge, onClose }: { charge: OtherCharge | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [f, setF] = useState({ code: charge?.code ?? '', name: charge?.name ?? '', calc: (charge?.calc ?? 'FIXED') as OtherCharge['calc'], fixed: charge ? (charge.fixed_amount_paise / 100).toFixed(2) : '0', pct: charge ? (charge.percent_bp / 100).toString() : '0',
    base: charge?.percent_base ?? 'RENT_LABOUR', sac: charge?.sac_code ?? '', gst: charge?.gst_rate_bp !== null && charge?.gst_rate_bp !== undefined ? (charge.gst_rate_bp / 100).toString() : '', active: charge?.is_active ?? true })
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v })
  const fixed = rup(f.fixed); const pct = bp(f.pct); const gst = f.gst === '' ? null : bp(f.gst)
  const save = useMutation({
    mutationFn: async () => {
      const row = { code: f.code.trim().toUpperCase(), name: f.name.trim(), calc: f.calc, fixed_amount_paise: fixed!, percent_bp: pct!, percent_base: f.base, sac_code: f.sac.trim() || null, gst_rate_bp: gst, is_active: f.active }
      const { error } = charge ? await supabase.from('other_charges').update(row).eq('id', charge.id) : await supabase.from('other_charges').insert(row)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); invalidate(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={charge ? t('rates.editCharge') : t('rates.newCharge')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={!/^[A-Z0-9_]{2,30}$/.test(f.code.trim().toUpperCase()) || !f.name.trim() || fixed === null || pct === null || (f.gst !== '' && gst === null) || (f.sac !== '' && !/^[0-9]{4,8}$/.test(f.sac))} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label={t('common.code')} htmlFor="oc-code" hint="A–Z, 0–9, _"><Input id="oc-code" disabled={!!charge} value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label={t('common.name')} htmlFor="oc-name"><Input id="oc-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={t('rates.chargeCalc')} htmlFor="oc-calc"><Select id="oc-calc" value={f.calc} onChange={(e) => set('calc', e.target.value)}><option value="FIXED">{t('billing.fixed')}</option><option value="PERCENT">{t('billing.percent')}</option></Select></Field>
        {f.calc === 'FIXED' ? <Field label={t('billing.amountRupees')} htmlFor="oc-fixed"><Input id="oc-fixed" inputMode="decimal" value={f.fixed} onChange={(e) => set('fixed', e.target.value)} /></Field> : <>
          <Field label={t('rates.percentValue')} htmlFor="oc-pct"><Input id="oc-pct" inputMode="decimal" value={f.pct} onChange={(e) => set('pct', e.target.value)} /></Field>
          <Field label={t('rates.percentBase')} htmlFor="oc-base" className="col-span-2"><Select id="oc-base" value={f.base} onChange={(e) => set('base', e.target.value)}><option value="RENT">{t('billing.sectionRENT')}</option><option value="LABOUR">{t('billing.sectionLABOUR')}</option><option value="RENT_LABOUR">{t('rates.rentAndLabour')}</option></Select></Field></>}
        <Field label={t('billing.sac')} htmlFor="oc-sac" optional><Input id="oc-sac" value={f.sac} onChange={(e) => set('sac', e.target.value)} /></Field>
        <Field label={t('billing.gstRatePercent')} htmlFor="oc-gst" optional hint={t('billing.defaultFromTaxRules')}><Input id="oc-gst" inputMode="decimal" value={f.gst} onChange={(e) => set('gst', e.target.value)} /></Field>
        <div className="col-span-2"><Checkbox label={t('common.active')} checked={f.active} onChange={(e) => set('active', e.target.checked)} /></div>
      </div>
    </Modal>
  )
}

function ChargesTab({ editable }: { editable: boolean }) {
  const { t } = useTranslation()
  const charges = useOtherCharges()
  const [form, setForm] = useState<{ charge: OtherCharge | null } | null>(null)
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-200 p-3"><p className="text-sm text-slate-500">{t('rates.chargesHelp')}</p>{editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ charge: null })}>{t('rates.newCharge')}</Button>}</div>
      <table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">{t('common.name')}</th><th className="px-3 py-2">{t('rates.chargeCalc')}</th><th className="px-3 py-2">{t('billing.sac')}</th><th className="px-3 py-2">GST</th><th className="px-3 py-2">{t('common.status')}</th><th /></tr></thead>
        <tbody>{(charges.data ?? []).map((c) => <tr key={c.id}><td className="px-3 py-2 font-medium">{c.name} <span className="font-mono text-xs text-slate-400">{c.code}</span></td>
          <td className="px-3 py-2">{c.calc === 'FIXED' ? formatINR(c.fixed_amount_paise) : `${bpToPercent(c.percent_bp)} · ${c.percent_base}`}</td><td className="px-3 py-2">{c.sac_code ?? t('rates.fromTaxRules')}</td><td className="px-3 py-2">{c.gst_rate_bp === null ? t('rates.fromTaxRules') : bpToPercent(c.gst_rate_bp)}</td>
          <td className="px-3 py-2"><Badge tone={c.is_active ? 'green' : 'gray'}>{c.is_active ? t('common.active') : t('common.inactive')}</Badge></td>
          <td className="px-3 py-2">{editable && <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setForm({ charge: c })}>{t('common.edit')}</Button>}</td></tr>)}</tbody></table>
      {form && <ChargeForm charge={form.charge} onClose={() => setForm(null)} />}
    </Card>
  )
}

// ---------------------------------------------------------------- tax rules ----------------------------------------------------------------
function TaxForm({ rule, onClose }: { rule: TaxRule | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [f, setF] = useState({ section: (rule?.section ?? 'RENT') as TaxRule['section'], st: rule?.storage_type ?? '', sac: rule?.sac_code ?? '', gst: rule ? (rule.gst_rate_bp / 100).toString() : '18', desc: rule?.description ?? '', from: rule?.valid_from ?? todayIso(), to: rule?.valid_to ?? '' })
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const gst = bp(f.gst)
  const save = useMutation({
    mutationFn: async () => {
      const row = { section: f.section, storage_type: f.section === 'RENT' && f.st ? (f.st as TaxRule['storage_type']) : null, sac_code: f.sac.trim(), gst_rate_bp: gst!, description: f.desc.trim() || null, valid_from: f.from, valid_to: f.to || null }
      const { error } = rule ? await supabase.from('tax_rules').update(row).eq('id', rule.id) : await supabase.from('tax_rules').insert(row)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); invalidate(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={rule ? t('rates.editTaxRule') : t('rates.newTaxRule')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={!/^[0-9]{4,8}$/.test(f.sac.trim()) || gst === null || !f.from} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label={t('billing.section')} htmlFor="tx-sec"><Select id="tx-sec" value={f.section} onChange={(e) => set('section', e.target.value)}>{(['RENT', 'LABOUR', 'OTHER'] as const).map((s) => <option key={s} value={s}>{t(`billing.section${s}`)}</option>)}</Select></Field>
        {f.section === 'RENT' && <Field label={t('billing.storageType')} htmlFor="tx-st" optional><Select id="tx-st" value={f.st} onChange={(e) => set('st', e.target.value)}><option value="">{t('rates.anyStorage')}</option>{STORAGE_TYPES.map((s) => <option key={s} value={s}>{t(`storageType.${s}`)}</option>)}</Select></Field>}
        <Field label={t('billing.sac')} htmlFor="tx-sac"><Input id="tx-sac" value={f.sac} onChange={(e) => set('sac', e.target.value)} /></Field>
        <Field label={t('billing.gstRatePercent')} htmlFor="tx-gst"><Input id="tx-gst" inputMode="decimal" value={f.gst} onChange={(e) => set('gst', e.target.value)} /></Field>
        <Field label={t('billing.description')} htmlFor="tx-desc" optional className="col-span-2"><Input id="tx-desc" value={f.desc} onChange={(e) => set('desc', e.target.value)} /></Field>
        <Field label={t('rates.validFrom')} htmlFor="tx-from"><Input id="tx-from" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></Field>
        <Field label={t('rates.validTo')} htmlFor="tx-to" optional><Input id="tx-to" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function TaxTab({ editable }: { editable: boolean }) {
  const { t } = useTranslation()
  const rules = useQuery({ queryKey: ['tax_rules'], queryFn: async () => { const { data, error } = await supabase.from('tax_rules').select('*').order('section').order('valid_from', { ascending: false }); if (error) throw error; return data } })
  const [form, setForm] = useState<{ rule: TaxRule | null } | null>(null)
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-200 p-3"><p className="text-sm text-amber-800">{t('rates.taxHelp')}</p>{editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ rule: null })}>{t('rates.newTaxRule')}</Button>}</div>
      <table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">{t('billing.section')}</th><th className="px-3 py-2">{t('billing.storageType')}</th><th className="px-3 py-2">{t('billing.sac')}</th><th className="px-3 py-2">GST</th><th className="px-3 py-2">{t('rates.validity')}</th><th /></tr></thead>
        <tbody>{(rules.data ?? []).map((r) => <tr key={r.id}><td className="px-3 py-2">{t(`billing.section${r.section}`)}</td><td className="px-3 py-2">{r.storage_type ? t(`storageType.${r.storage_type}`) : t('rates.anyStorage')}</td><td className="px-3 py-2 font-mono">{r.sac_code}</td><td className="px-3 py-2">{bpToPercent(r.gst_rate_bp)}</td>
          <td className="px-3 py-2">{formatDate(r.valid_from)} – {r.valid_to ? formatDate(r.valid_to) : t('rates.open')}</td><td className="px-3 py-2">{editable && <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setForm({ rule: r })}>{t('common.edit')}</Button>}</td></tr>)}</tbody></table>
      {form && <TaxForm rule={form.rule} onClose={() => setForm(null)} />}
    </Card>
  )
}

// ---------------------------------------------------------------- rate preview tester ----------------------------------------------------------------
function TesterTab() {
  const { t } = useTranslation()
  const clients = useClients(); const warehouses = useWarehouses(); const types = useBrigadeTypes()
  const [f, setF] = useState({ client: '', wh: '', kind: 'RENT', storage: 'FROZEN', tmin: '', tmax: '', bt: '', brigades: '1', activity: 'UNLOADING', date: todayIso() })
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const ready = !!f.client && !!f.wh && !!f.date
  const rent = useQuery({ queryKey: ['rate_test_rent', f], enabled: ready && f.kind === 'RENT', queryFn: async () => {
    const { data, error } = await supabase.rpc('rent_rate_candidates', { p_client_id: f.client, p_warehouse_id: f.wh, p_storage_type: f.storage as never, p_temp_min: num(f.tmin) as number, p_temp_max: num(f.tmax) as number, p_brigade_type_id: (f.bt || null) as string, p_date: f.date, p_brigades: Math.max(1, Math.trunc(Number(f.brigades) || 1)) })
    if (error) throw error; return data } })
  const labour = useQuery({ queryKey: ['rate_test_labour', f], enabled: ready && f.kind === 'LABOUR', queryFn: async () => {
    const { data, error } = await supabase.rpc('labour_rate_candidates', { p_client_id: f.client, p_warehouse_id: f.wh, p_activity: f.activity as never, p_date: f.date })
    if (error) throw error; return data } })
  const rows: { key: string; rank: number; text: string; rate: number; basis: string }[] = useMemo(() => f.kind === 'RENT'
    ? (rent.data ?? []).map((r) => ({ key: r.rent_rate_id, rank: r.rank, text: r.source, rate: r.rate_paise, basis: r.basis }))
    : (labour.data ?? []).map((r) => ({ key: r.labour_rate_id, rank: r.rank, text: r.source, rate: r.rate_paise, basis: r.basis })), [f.kind, rent.data, labour.data])
  const pending = f.kind === 'RENT' ? rent.isFetching : labour.isFetching
  const err = (f.kind === 'RENT' ? rent.error : labour.error) as { message?: string } | null
  return (
    <Card className="p-4">
      <p className="mb-3 text-sm text-slate-500">{t('rates.testerHelp')}</p>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <Field label={t('common.client')} htmlFor="ts-client"><Select id="ts-client" value={f.client} onChange={(e) => set('client', e.target.value)}><option value="">{t('common.select')}</option>{(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</Select></Field>
        <Field label={t('common.warehouse')} htmlFor="ts-wh"><Select id="ts-wh" value={f.wh} onChange={(e) => set('wh', e.target.value)}><option value="">{t('common.select')}</option>{(warehouses.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select></Field>
        <Field label={t('common.date')} htmlFor="ts-date"><Input id="ts-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label={t('rates.rateKind')} htmlFor="ts-kind"><Select id="ts-kind" value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="RENT">{t('rates.rentRates')}</option><option value="LABOUR">{t('rates.labourRates')}</option></Select></Field>
        {f.kind === 'RENT' ? <>
          <Field label={t('billing.storageType')} htmlFor="ts-st"><Select id="ts-st" value={f.storage} onChange={(e) => set('storage', e.target.value)}>{STORAGE_TYPES.map((s) => <option key={s} value={s}>{t(`storageType.${s}`)}</option>)}</Select></Field>
          <Field label={t('rates.brigadesHeld')} htmlFor="ts-n"><Input id="ts-n" type="number" min={1} value={f.brigades} onChange={(e) => set('brigades', e.target.value)} /></Field>
          <Field label={t('rates.tempMin')} htmlFor="ts-tmin" optional><Input id="ts-tmin" inputMode="decimal" value={f.tmin} onChange={(e) => set('tmin', e.target.value)} /></Field>
          <Field label={t('rates.tempMax')} htmlFor="ts-tmax" optional><Input id="ts-tmax" inputMode="decimal" value={f.tmax} onChange={(e) => set('tmax', e.target.value)} /></Field>
          <Field label={t('rates.brigadeType')} htmlFor="ts-bt" optional><Select id="ts-bt" value={f.bt} onChange={(e) => set('bt', e.target.value)}><option value="">{t('rates.anyBrigadeType')}</option>{(types.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field></>
          : <Field label={t('rates.activity')} htmlFor="ts-act"><Select id="ts-act" value={f.activity} onChange={(e) => set('activity', e.target.value)}>{LABOUR_ACTIVITIES.map((a) => <option key={a} value={a}>{t(`labourActivity.${a}`)}</option>)}</Select></Field>}
      </div>
      <div className="mt-4" data-testid="rate-test-result">
        {!ready ? <p className="text-sm text-slate-500">{t('rates.testerPick')}</p> : pending ? <Spinner /> : err ? <p className="text-sm text-red-600">{err.message}</p> : rows.length === 0 ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t('rates.noRateApplies')}</p> : (
          <ol className="space-y-2">{rows.map((r) => (
            <li key={r.key} className={`rounded-lg border p-3 text-sm ${r.rank === 1 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white text-slate-500'}`}>
              <div className="flex items-center justify-between"><span className="font-medium">{r.rank === 1 ? t('rates.appliesThis') : t('rates.overridden', { rank: r.rank })}</span><span className="font-semibold">{formatINR(r.rate)}</span></div>
              <p className="mt-1 text-xs">{r.text}</p></li>))}</ol>)}
      </div>
    </Card>
  )
}

export function RatesPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const editable = canWrite(profile?.role, 'rates')
  const [tab, setTab] = useState<Tab>('cards')
  const tabs: [Tab, string][] = [['cards', t('rates.tabCards')], ['charges', t('rates.tabCharges')], ['tax', t('rates.tabTax')], ['tester', t('rates.tabTester')]]
  const body: Record<Tab, ReactNode> = { cards: <CardsTab editable={editable} />, charges: <ChargesTab editable={editable} />, tax: <TaxTab editable={editable} />, tester: <TesterTab /> }
  return (
    <div>
      <PageHeader title={t('rates.title')} />
      {!editable && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t('common.readOnly')}</p>}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
      </div>
      {body[tab]}
    </div>
  )
}
