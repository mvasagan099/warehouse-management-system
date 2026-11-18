import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Badge, Card, ErrorState, PageHeader } from '../../components/ui/misc'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type LabourActivity } from '../../lib/types'
import { lineTotals, placementProblems, type LineCount, type Placement } from './receive'

interface LabourRow { key: string; activity: LabourActivity; packages: string; tonnes: string; workers: string; hours: string; night?: boolean; overtime?: boolean }
const key = () => crypto.randomUUID()

/** Gate entry -> unloading count per line -> suggested slots -> confirm (one database transaction). */
export function ReceivePage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [counts, setCounts] = useState<Record<string, LineCount>>({})
  const [placements, setPlacements] = useState<Placement[]>([])
  const [labour, setLabour] = useState<LabourRow[]>([])
  const [remarks, setRemarks] = useState('')
  const [suggested, setSuggested] = useState(false)

  const data = useQuery({
    queryKey: ['receive', id],
    queryFn: async () => {
      const [g, l] = await Promise.all([
        supabase.from('gate_entries').select('*').eq('id', id).single(),
        supabase.from('gate_entry_lines').select('*').eq('gate_entry_id', id).is('deleted_at', null).order('line_no'),
      ])
      if (g.error) throw g.error
      if (l.error) throw l.error
      const s = await supabase.from('brigade_slots').select('id, code, status, zone_id')
        .eq('warehouse_id', g.data.warehouse_id).is('deleted_at', null).in('status', ['FREE', 'RESERVED', 'OCCUPIED']).order('code').limit(2000)
      if (s.error) throw s.error
      return { gate: g.data, lines: l.data, slots: s.data }
    },
  })

  useEffect(() => {
    if (!data.data) return
    setCounts((prev) => Object.keys(prev).length ? prev : Object.fromEntries(data.data.lines.map((l) => [l.id, { accepted: String(l.counted_qty ?? l.declared_qty), damaged: '0', remarks: '' }])))
  }, [data.data])

  // one tap receiving: as soon as the counts are filled in (they start equal to what the driver declared), slots are suggested automatically
  const autoDone = useRef(false)
  useEffect(() => {
    if (!data.data || autoDone.current || Object.keys(counts).length === 0 || data.data.lines.length === 0) return
    autoDone.current = true
    suggest.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.data, counts])
  const [showSlots, setShowSlots] = useState(false)

  const slotLabel = useMemo(() => new Map((data.data?.slots ?? []).map((s) => [s.id, s.code])), [data.data])
  const problems = useMemo(() => (data.data ? placementProblems(data.data.lines, counts, placements) : {}), [data.data, counts, placements])
  const allOk = !!data.data && data.data.lines.length > 0 && Object.values(problems).every((v) => v === null)
  const labourOk = labour.every((r) => Number(r.workers) >= 1 && Number(r.hours) >= 0 && r.hours !== '')  // labour is optional: an empty list is fine

  const countsPayload = () => data.data!.lines.map((l) => ({
    gate_entry_line_id: l.id,
    accepted_qty: Number(counts[l.id]?.accepted || 0),
    damaged_qty: Number(counts[l.id]?.damaged || 0),
    remarks: counts[l.id]?.remarks ?? '',
  }))

  const suggest = useMutation({
    mutationFn: async () => {
      const { data: rows, error } = await supabase.rpc('suggest_inward_slots', { p_gate_entry_id: id, p_counts: countsPayload() })
      if (error) throw error
      return rows
    },
    onSuccess: (rows) => {
      setPlacements(rows.map((r) => ({ key: key(), line_id: r.gate_entry_line_id, slot_id: r.slot_id, quantity: String(r.quantity), condition: r.condition })))
      setSuggested(true)
      toast.success(t('receive.suggested', { count: rows.length }))
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const confirm = useMutation({
    mutationFn: async () => {
      const { data: receiptId, error } = await supabase.rpc('confirm_inward_receipt', {
        p_gate_entry_id: id,
        p_lines: countsPayload(),
        p_placements: placements.map((p) => ({ gate_entry_line_id: p.line_id, slot_id: p.slot_id, quantity: Number(p.quantity), condition: p.condition })),
        p_labour: labour.map((r) => ({ activity: r.activity, packages: Number(r.packages || 0), tonnes: Number(r.tonnes || 0), workers: Number(r.workers), hours: Number(r.hours), is_night: !!r.night, is_overtime: !!r.overtime })),
        p_remarks: remarks || undefined,
      })
      if (error) throw error
      return receiptId
    },
    onSuccess: (receiptId) => {
      toast.success(t('receive.confirmed'))
      for (const k of ['gate_entries', 'gate_entry', 'receipts', 'stock', 'v_zone_slot_summary']) void qc.invalidateQueries({ queryKey: [k] })
      navigate(`/receipts/${receiptId}`)
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  if (data.isPending) return <FullPageSpinner />
  if (data.error || !data.data) return <ErrorState message={t('common.error')} onRetry={() => data.refetch()} retryLabel={t('common.retry')} />
  const { gate, lines, slots } = data.data
  if (gate.direction !== 'INWARD' || !['AT_GATE', 'UNLOADING'].includes(gate.status)) {
    return <ErrorState message={t('receive.notReceivable', { status: t(`gateStatus.${gate.status}`) })} />
  }

  const setCount = (lineId: string, patch: Partial<LineCount>) => setCounts((c) => ({ ...c, [lineId]: { ...c[lineId], ...patch } }))
  const setPlacement = (k: string, patch: Partial<Placement>) => setPlacements((ps) => ps.map((p) => (p.key === k ? { ...p, ...patch } : p)))
  const setLab = (k: string, patch: Partial<LabourRow>) => setLabour((rs) => rs.map((r) => (r.key === k ? { ...r, ...patch } : r)))
  const problemText = (p: string | null) => p === null ? null : t(`receive.problem.${p}`)

  return (
    <div className="space-y-5">
      <Link to={`/gate/${gate.id}`} className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" />{t('common.back')}</Link>
      <PageHeader title={t('receive.title')} subtitle={`${gate.gate_pass_no} · ${gate.lorry_number}`} />

      <Card>
        <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">1 · {t('receive.countStep')}</h2>
        <div className="divide-y divide-slate-100">
          {lines.map((l) => {
            const tot = lineTotals(l, counts[l.id] ?? { accepted: '', damaged: '', remarks: '' })
            return (
              <div key={l.id} className="grid gap-3 p-4 md:grid-cols-[2fr_repeat(4,1fr)]">
                <div>
                  <div className="font-medium">{l.line_no}. {l.item_name}</div>
                  <div className="text-xs text-slate-500">{l.sku} {l.batch_no && `· ${l.batch_no}`} · {l.required_temp_c !== null ? `${l.required_temp_c} °C` : ''} {l.storage_type ? t(`storageType.${l.storage_type}`) : ''}</div>
                </div>
                <div><div className="text-xs uppercase text-slate-500">{t('gate.declaredQty')}</div><div className="py-2 font-medium">{formatNumber(tot.declared, lang, 3)} {l.unit}</div></div>
                <Field label={t('receive.accepted')} htmlFor={`acc-${l.id}`}><Input id={`acc-${l.id}`} inputMode="decimal" value={counts[l.id]?.accepted ?? ''} onChange={(e) => setCount(l.id, { accepted: e.target.value })} className="h-11 text-base" /></Field>
                <Field label={t('receive.damaged')} htmlFor={`dmg-${l.id}`}><Input id={`dmg-${l.id}`} inputMode="decimal" value={counts[l.id]?.damaged ?? ''} onChange={(e) => setCount(l.id, { damaged: e.target.value })} className="h-11 text-base" /></Field>
                <div><div className="text-xs uppercase text-slate-500">{t('receive.short')}</div><div className={`py-2 font-medium ${tot.short > 0 ? 'text-amber-700' : ''}`}>{formatNumber(tot.short, lang, 3)}</div></div>
                <div className="md:col-span-5"><Input aria-label={`${t('common.notes')} ${l.line_no}`} placeholder={t('receive.lineRemarks')} value={counts[l.id]?.remarks ?? ''} onChange={(e) => setCount(l.id, { remarks: e.target.value })} /></div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">2 · {t('receive.slotStep')}</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Sparkles className="h-4 w-4" />} loading={suggest.isPending} onClick={() => suggest.mutate()}>{t('receive.suggest')}</Button>
            {allOk && <Button size="sm" variant="ghost" onClick={() => setShowSlots(!showSlots)}>{showSlots ? t('receive.hideSlots') : t('receive.changeSlots')}</Button>}
          </div>
        </div>
        {allOk && !showSlots && <p className="px-4 py-3 text-sm text-emerald-700" data-testid="slots-summary">{t('receive.slotsChosen', { count: placements.length, slots: [...new Set(placements.map((p) => slotLabel.get(p.slot_id) ?? ''))].filter(Boolean).join(', ') })}</p>}
        {(showSlots || !allOk) && <p className="px-4 pt-3 text-sm text-slate-500">{t('receive.slotHelp')}</p>}
        {(showSlots || !allOk) && <div className="divide-y divide-slate-100">
          {lines.map((l) => {
            const mine = placements.filter((p) => p.line_id === l.id)
            const prob = problems[l.id]
            return (
              <div key={l.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{l.line_no}. {l.item_name}</span>
                  {suggested || mine.length ? (prob === null ? <Badge tone="green">{t('receive.balanced')}</Badge> : <Badge tone="amber">{problemText(prob)}</Badge>) : null}
                </div>
                {mine.map((p) => (
                  <div key={p.key} className="mb-2 grid grid-cols-[1fr_6rem_8rem_auto] items-center gap-2">
                    <Select aria-label={t('common.slot')} value={p.slot_id} onChange={(e) => setPlacement(p.key, { slot_id: e.target.value })}>
                      <option value="">{t('common.select')}</option>
                      {slots.map((s) => <option key={s.id} value={s.id}>{s.code} · {t(`slotStatus.${s.status}`)}</option>)}
                      {p.slot_id && !slotLabel.has(p.slot_id) && <option value={p.slot_id}>{p.slot_id}</option>}
                    </Select>
                    <Input aria-label={t('common.quantity')} inputMode="decimal" value={p.quantity} onChange={(e) => setPlacement(p.key, { quantity: e.target.value })} />
                    <Select aria-label={t('receive.condition')} value={p.condition} onChange={(e) => setPlacement(p.key, { condition: e.target.value as Placement['condition'] })}>
                      {Constants.public.Enums.stock_condition.map((c) => <option key={c} value={c}>{t(`stockCondition.${c}`)}</option>)}
                    </Select>
                    <Button variant="ghost" size="sm" aria-label={t('common.remove')} icon={<Trash2 className="h-4 w-4" />} onClick={() => setPlacements((ps) => ps.filter((x) => x.key !== p.key))} />
                  </div>
                ))}
                <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />}
                  onClick={() => setPlacements((ps) => [...ps, { key: key(), line_id: l.id, slot_id: '', quantity: '', condition: 'GOOD' }])}>{t('receive.addPlacement')}</Button>
              </div>
            )
          })}
        </div>}
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">3 · {t('receive.labourStep')} <span className="text-sm font-normal text-slate-500">({t('common.optional')})</span></h2>
          <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />}
            onClick={() => setLabour((r) => [...r, { key: key(), activity: 'STACKING', packages: '', tonnes: '', workers: '', hours: '' }])}>{t('receive.addLabour')}</Button>
        </div>
        <div className="space-y-2 p-4">
          {labour.length === 0 && <p className="text-sm text-slate-500">{t('receive.labourSkip')}</p>}
          {labour.map((r) => (
            <div key={r.key} className="grid grid-cols-2 gap-2 md:grid-cols-[1.5fr_repeat(4,1fr)_auto]">
              <Select aria-label={t('receive.activity')} value={r.activity} onChange={(e) => setLab(r.key, { activity: e.target.value as LabourActivity })}>
                {Constants.public.Enums.labour_activity.filter((a) => a !== 'LOADING').map((a) => <option key={a} value={a}>{t(`labourActivity.${a}`)}</option>)}
              </Select>
              <Input aria-label={t('gate.packages')} placeholder={t('gate.packages')} inputMode="numeric" value={r.packages} onChange={(e) => setLab(r.key, { packages: e.target.value })} />
              <Input aria-label={t('receive.tonnes')} placeholder={t('receive.tonnes')} inputMode="decimal" value={r.tonnes} onChange={(e) => setLab(r.key, { tonnes: e.target.value })} />
              <Input aria-label={t('receive.workers')} placeholder={t('receive.workers')} inputMode="numeric" value={r.workers} onChange={(e) => setLab(r.key, { workers: e.target.value })} />
              <Input aria-label={t('receive.hours')} placeholder={t('receive.hours')} inputMode="decimal" value={r.hours} onChange={(e) => setLab(r.key, { hours: e.target.value })} />
              <Button variant="ghost" size="sm" aria-label={t('common.remove')} icon={<Trash2 className="h-4 w-4" />} onClick={() => setLabour((rs) => rs.filter((x) => x.key !== r.key))} />
              <div className="col-span-full flex gap-4">
                <Checkbox label={t('receive.night')} checked={!!r.night} onChange={(e) => setLab(r.key, { night: e.target.checked })} />
                <Checkbox label={t('receive.overtime')} checked={!!r.overtime} onChange={(e) => setLab(r.key, { overtime: e.target.checked })} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <Field label={t('receive.remarks')} htmlFor="rc-remarks" optional><Textarea id="rc-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{allOk && labourOk ? t('receive.readyHint') : t('receive.notReadyHint')}</p>
          <Button className="h-12 px-8 text-base" icon={<CheckCircle2 className="h-5 w-5" />} disabled={!allOk || !labourOk} loading={confirm.isPending} onClick={() => confirm.mutate()}>
            {t('receive.confirm')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
