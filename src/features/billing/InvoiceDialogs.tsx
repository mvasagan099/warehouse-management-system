import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../lib/errors'
import { formatINR, rupeesToPaise } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import type { Invoice, InvoiceLine, NoteKind, PaymentMethod } from '../../lib/types'
import { PAYMENT_METHODS, owed, percentToBp } from './common'
import { useOtherCharges } from './queries'

const todayIso = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
const safeRupees = (v: string) => { try { return rupeesToPaise(v) } catch { return null } }
export const refreshBilling = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of ['invoices', 'invoice', 'payments', 'ledger', 'ageing', 'daily_occupancy']) void qc.invalidateQueries({ queryKey: [k] })
}

/** Fix the amount of a draft line (reason required) or mark it exempt. */
export function FixLineDialog({ line, onClose }: { line: InvoiceLine; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [amount, setAmount] = useState((line.amount_paise / 100).toFixed(2))
  const [reason, setReason] = useState('')
  const [exempt, setExempt] = useState(line.exempt)
  const [exemptReason, setExemptReason] = useState(line.exempt_reason ?? '')
  const paise = safeRupees(amount)
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fix_invoice_line', { p_line_id: line.id, p_amount_paise: paise!, p_reason: reason.trim(), p_exempt: exempt, p_exempt_reason: exempt ? exemptReason.trim() : undefined })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('billing.lineFixed')); refreshBilling(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('billing.fixLine')} onClose={onClose} footer={<>
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={paise === null || !reason.trim() || (exempt && !exemptReason.trim())} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">{line.description}</p>
        <p className="text-xs text-slate-500">{t('billing.calculatedAmount')}: {formatINR(line.original_amount_paise ?? line.amount_paise)}</p>
        <Field label={t('billing.amountRupees')} htmlFor="fl-amt" hint={t('billing.discountAppliesAfter')}><Input id="fl-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={t('common.reasonRequired')} htmlFor="fl-reason"><Textarea id="fl-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Checkbox label={t('billing.exemptLine')} checked={exempt} onChange={(e) => setExempt(e.target.checked)} />
        {exempt && <Field label={t('billing.exemptReason')} htmlFor="fl-ex"><Input id="fl-ex" value={exemptReason} onChange={(e) => setExemptReason(e.target.value)} /></Field>}
      </div>
    </Modal>
  )
}

/** Add a line to section C: from the other-charges master, or a manual charge with a reason. */
export function AddChargeDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const charges = useOtherCharges()
  const [chargeId, setChargeId] = useState('')
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState('1')
  const [amount, setAmount] = useState('')
  const [sac, setSac] = useState('')
  const [gst, setGst] = useState('')
  const [reason, setReason] = useState('')
  const master = (charges.data ?? []).find((c) => c.id === chargeId)
  const paise = master ? (master.calc === 'FIXED' ? master.fixed_amount_paise ?? 0 : 0) : safeRupees(amount)
  const valid = (master ? true : !!description.trim() && paise !== null && paise > 0 && !!reason.trim()) && Number(qty) > 0
  let gstBp: number | undefined
  try { gstBp = gst ? percentToBp(gst) : undefined } catch { gstBp = undefined }
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('add_other_charge', {
        p_invoice_id: invoice.id, p_charge_id: master?.id as string, p_description: (master ? master.name : description).trim(),
        p_quantity: Number(qty), p_amount_paise: (master ? paise : paise!) as number, p_reason: reason.trim() || (master ? master.name : ''),
        p_sac_code: sac.trim() || undefined, p_gst_rate_bp: gstBp,
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('billing.chargeAdded')); refreshBilling(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('billing.addCharge')} onClose={onClose} footer={<>
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={add.isPending} disabled={!valid} onClick={() => add.mutate()}>{t('common.create')}</Button></>}>
      <div className="space-y-3 text-sm">
        <Field label={t('billing.chargeMaster')} htmlFor="ac-master">
          <Select id="ac-master" value={chargeId} onChange={(e) => setChargeId(e.target.value)}>
            <option value="">{t('billing.manualCharge')}</option>
            {(charges.data ?? []).filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        {!master && <>
          <Field label={t('billing.description')} htmlFor="ac-desc"><Input id="ac-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.quantity')} htmlFor="ac-qty"><Input id="ac-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label={t('billing.unitAmount')} htmlFor="ac-amt"><Input id="ac-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label={t('billing.sac')} htmlFor="ac-sac" optional><Input id="ac-sac" value={sac} onChange={(e) => setSac(e.target.value)} /></Field>
            <Field label={t('billing.gstRatePercent')} htmlFor="ac-gst" optional hint={t('billing.defaultFromTaxRules')}><Input id="ac-gst" inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} /></Field>
          </div>
          <Field label={t('common.reasonRequired')} htmlFor="ac-reason"><Textarea id="ac-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </>}
        {master && <p className="rounded-lg bg-slate-50 p-2 text-slate-600">{master.calc === 'FIXED' ? `${t('billing.fixed')}: ${formatINR(master.fixed_amount_paise ?? 0)}` : `${t('billing.percentOf')} ${(master.percent_bp ?? 0) / 100}% (${master.percent_base})`}</p>}
      </div>
    </Modal>
  )
}

interface NoteLineDraft { section: 'RENT' | 'LABOUR' | 'OTHER'; description: string; amount: string }
/** Credit or debit note. A credit note with no lines reverses the whole invoice. */
export function NoteDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [kind, setKind] = useState<NoteKind>('CREDIT')
  const [reason, setReason] = useState('')
  const [full, setFull] = useState(true)
  const [lines, setLines] = useState<NoteLineDraft[]>([{ section: 'RENT', description: '', amount: '' }])
  const parsed = lines.map((l) => ({ ...l, paise: safeRupees(l.amount) }))
  const linesOk = parsed.every((l) => l.paise !== null && l.paise > 0)
  const mustHaveLines = kind === 'DEBIT' || !full
  const save = useMutation({
    mutationFn: async () => {
      const p_lines = mustHaveLines ? parsed.map((l) => ({ section: l.section, description: l.description.trim() || undefined, taxable_paise: l.paise })) : undefined
      const { error } = await supabase.rpc('issue_adjustment_note', { p_invoice_id: invoice.id, p_kind: kind, p_reason: reason.trim(), p_lines: p_lines as never })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('billing.noteIssued')); refreshBilling(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open size="lg" title={t('billing.newNote')} onClose={onClose} footer={<>
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={!reason.trim() || (mustHaveLines && !linesOk)} onClick={() => save.mutate()}>{t('billing.issueNote')}</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">{t('billing.noteHelp', { no: invoice.invoice_no })}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('billing.noteKind')} htmlFor="nt-kind">
            <Select id="nt-kind" value={kind} onChange={(e) => setKind(e.target.value as NoteKind)}>
              <option value="CREDIT">{t('billing.credit')}</option><option value="DEBIT">{t('billing.debit')}</option>
            </Select>
          </Field>
          {kind === 'CREDIT' && <div className="flex items-end pb-2"><Checkbox label={t('billing.fullReversal')} checked={full} onChange={(e) => setFull(e.target.checked)} /></div>}
        </div>
        <Field label={t('common.reasonRequired')} htmlFor="nt-reason"><Textarea id="nt-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {mustHaveLines && (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <Select aria-label={t('billing.section')} className="col-span-3" value={l.section} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, section: e.target.value as NoteLineDraft['section'] } : x))}>
                  <option value="RENT">{t('billing.sectionRENT')}</option><option value="LABOUR">{t('billing.sectionLABOUR')}</option><option value="OTHER">{t('billing.sectionOTHER')}</option>
                </Select>
                <Input aria-label={t('billing.description')} placeholder={t('billing.description')} className="col-span-5" value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                <Input aria-label={t('billing.taxableAmount')} placeholder={t('billing.taxableAmount')} inputMode="decimal" className="col-span-3" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                <Button variant="ghost" size="sm" className="col-span-1" aria-label={t('common.remove')} disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setLines([...lines, { section: 'RENT', description: '', amount: '' }])}>{t('billing.addNoteLine')}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function PaymentDialog({ clientId, warehouseId, invoice, onClose }: { clientId?: string; warehouseId?: string; invoice?: Invoice; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [method, setMethod] = useState<PaymentMethod>('UPI')
  const [amount, setAmount] = useState(invoice ? (owed(invoice) / 100).toFixed(2) : '')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [cid, setCid] = useState(clientId ?? invoice?.client_id ?? '')
  const [wid, setWid] = useState(warehouseId ?? invoice?.warehouse_id ?? '')
  const paise = safeRupees(amount)
  const clients = useClientsLite()
  const warehouses = useWarehousesLite()
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('record_payment', { p_client_id: cid, p_warehouse_id: wid, p_amount_paise: paise!, p_method: method, p_reference: reference.trim(), p_paid_on: date, p_invoice_id: invoice?.id, p_notes: notes.trim() || undefined })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('billing.paymentRecorded')); refreshBilling(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('billing.recordPayment')} onClose={onClose} footer={<>
      <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={!cid || !wid || paise === null || paise <= 0 || !date} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {!invoice && <>
          <Field label={t('common.client')} htmlFor="pm-client" className="col-span-2"><Select id="pm-client" value={cid} onChange={(e) => setCid(e.target.value)}><option value="">{t('common.select')}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</Select></Field>
          <Field label={t('common.warehouse')} htmlFor="pm-wh" className="col-span-2"><Select id="pm-wh" value={wid} onChange={(e) => setWid(e.target.value)}><option value="">{t('common.select')}</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select></Field>
        </>}
        {invoice && <p className="col-span-2 rounded-lg bg-slate-50 p-2">{invoice.invoice_no} · {t('billing.outstanding')}: {formatINR(owed(invoice))}</p>}
        <Field label={t('billing.method')} htmlFor="pm-method"><Select id="pm-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`paymentMethod.${m}`)}</option>)}</Select></Field>
        <Field label={t('billing.amountRupees')} htmlFor="pm-amt" hint={t('billing.paymentHelp')}><Input id="pm-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={t('billing.reference')} htmlFor="pm-ref" optional><Input id="pm-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label={t('common.date')} htmlFor="pm-date"><Input id="pm-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t('common.notes')} htmlFor="pm-notes" optional className="col-span-2"><Input id="pm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

import { useClients, useWarehouses } from '../shared/queries'
function useClientsLite() { return (useClients().data ?? []).filter((c) => c.status === 'ACTIVE' || c.status === 'ON_HOLD') }
function useWarehousesLite() { return (useWarehouses().data ?? []).filter((w) => w.is_active) }
