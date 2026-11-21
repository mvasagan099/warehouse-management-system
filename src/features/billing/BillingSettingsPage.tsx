import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '../../components/ui/Field'
import { Card, PageHeader } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { qk } from '../shared/queries'
import { ONLINE_PAYMENTS } from './common'

type Json = Record<string, any>
function useSettings() {
  return useQuery({
    queryKey: [...qk.settings, 'all-billing'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value').in('key', ['supplier', 'invoice_terms', 'day_count_rule', 'billing_block', 'razorpay', 'email', 'reminders'])
      if (error) throw error
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, Json | string>
    },
  })
}

const SUPPLIER_FIELDS = ['name', 'legal_name', 'gstin', 'pan', 'state_code', 'state_name', 'address', 'phone', 'email', 'bank_name', 'bank_account', 'bank_ifsc', 'bank_branch', 'upi_id'] as const

export function BillingSettingsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const admin = canWrite(profile?.role, 'billingSettings')
  const settings = useSettings()
  const [supplier, setSupplier] = useState<Json>({})
  const [terms, setTerms] = useState('')
  const [dayRule, setDayRule] = useState<Json>({})
  const [block, setBlock] = useState<Json>({})
  const [rzp, setRzp] = useState(false)
  const [email, setEmail] = useState<Json>({})
  const [reminders, setReminders] = useState<Json>({})
  useEffect(() => {
    const s = settings.data; if (!s) return
    setSupplier(s.supplier as Json); setTerms(String(s.invoice_terms ?? '')); setDayRule(s.day_count_rule as Json); setBlock(s.billing_block as Json)
    setRzp(!!(s.razorpay as Json)?.enabled); setEmail(s.email as Json); setReminders(s.reminders as Json)
  }, [settings.data])

  const save = useMutation({
    mutationFn: async (key: string) => {
      const value: unknown = { supplier, invoice_terms: terms, day_count_rule: dayRule, billing_block: block, razorpay: { enabled: rzp }, email, reminders }[key]
      const { error } = await supabase.from('app_settings').update({ value: value as never }).eq('key', key)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: qk.settings }) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const backfill = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc('snapshot_occupancy_backfill'); if (error) throw error; return data },
    onSuccess: (n) => { toast.success(t('billing.backfilled', { count: n })); void qc.invalidateQueries({ queryKey: ['daily_occupancy'] }) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const [reFrom, setReFrom] = useState('')
  const [reTo, setReTo] = useState('')
  const recompute = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc('snapshot_occupancy_backfill', { p_from: reFrom, p_to: reTo, p_force: true }); if (error) throw error; return data },
    onSuccess: (n) => { toast.success(t('billing.backfilled', { count: n })); void qc.invalidateQueries({ queryKey: ['daily_occupancy'] }) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const remind = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke('send-reminders', { body: {} }); if (error) throw error; return data as { sent: number; skipped: number; failed: number } },
    onSuccess: (r) => toast.success(t('billing.remindersSent', r)),
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const saveBtn = (key: string) => admin && <Button loading={save.isPending && save.variables === key} onClick={() => save.mutate(key)}>{t('common.save')}</Button>
  const sectionCard = (title: string, children: React.ReactNode, key: string, help?: string) => (
    <Card className="p-4"><h2 className="font-semibold">{title}</h2>{help && <p className="mb-3 text-xs text-slate-500">{help}</p>}<div className="mt-3 space-y-3">{children}</div><div className="mt-4 flex justify-end">{saveBtn(key)}</div></Card>
  )
  const days = ((reminders.days_after_due ?? []) as number[]).join(', ')

  return (
    <div className="space-y-6">
      <PageHeader title={t('billing.settings')} />
      {!admin && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t('common.readOnly')}</p>}
      {sectionCard(t('billing.supplier'), <div className="grid gap-3 sm:grid-cols-2">{SUPPLIER_FIELDS.map((f) => (
        <Field key={f} label={t(`billing.supplierField.${f}`)} htmlFor={`sp-${f}`} className={f === 'address' ? 'sm:col-span-2' : ''}>
          <Input id={`sp-${f}`} disabled={!admin} value={String(supplier[f] ?? '')} onChange={(e) => setSupplier({ ...supplier, [f]: e.target.value })} /></Field>))}</div>, 'supplier', t('billing.supplierHelp'))}
      {sectionCard(t('billing.terms'), <Textarea aria-label={t('billing.terms')} disabled={!admin} value={terms} onChange={(e) => setTerms(e.target.value)} />, 'invoice_terms')}
      {sectionCard(t('billing.dayCount'), <div className="space-y-2">
        <Checkbox label={t('billing.includeStart')} disabled={!admin} checked={!!dayRule.include_start} onChange={(e) => setDayRule({ ...dayRule, include_start: e.target.checked })} />
        <Checkbox label={t('billing.includeEnd')} disabled={!admin} checked={!!dayRule.include_end} onChange={(e) => setDayRule({ ...dayRule, include_end: e.target.checked })} />
        <Checkbox label={t('billing.partDay')} disabled={!admin} checked={!!dayRule.part_day_counts} onChange={(e) => setDayRule({ ...dayRule, part_day_counts: e.target.checked })} /></div>, 'day_count_rule', t('billing.dayCountHelp'))}
      {sectionCard(t('billing.creditBlock'), <div className="space-y-2">
        <Checkbox label={t('billing.blockEnabled')} disabled={!admin} checked={!!block.enabled} onChange={(e) => setBlock({ ...block, enabled: e.target.checked })} />
        <Checkbox label={t('billing.blockOverLimit')} disabled={!admin} checked={!!block.block_over_credit_limit} onChange={(e) => setBlock({ ...block, block_over_credit_limit: e.target.checked })} />
        <Field label={t('billing.blockOverdueDays')} htmlFor="bb-days"><Input id="bb-days" type="number" min={0} disabled={!admin} className="w-32" value={String(block.overdue_days ?? 30)} onChange={(e) => setBlock({ ...block, overdue_days: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} /></Field></div>, 'billing_block', t('billing.creditBlockHelp'))}
      {sectionCard(t('billing.emailTitle'), <div className="space-y-2">
        <Checkbox label={t('billing.emailEnabled')} disabled={!admin} checked={!!email.enabled} onChange={(e) => setEmail({ ...email, enabled: e.target.checked })} />
        <Field label={t('billing.emailFrom')} htmlFor="em-from"><Input id="em-from" disabled={!admin} value={String(email.from ?? '')} onChange={(e) => setEmail({ ...email, from: e.target.value })} placeholder="Billing <billing@yourdomain.in>" /></Field>
        {admin && <Button variant="secondary" icon={<Mail className="h-4 w-4" />} loading={remind.isPending} onClick={() => remind.mutate()}>{t('billing.sendRemindersNow')}</Button>}</div>, 'email', t('billing.emailHelp'))}
      {sectionCard(t('billing.remindersTitle'), <div className="space-y-2">
        <Checkbox label={t('billing.remindersEnabled')} disabled={!admin} checked={reminders.enabled !== false} onChange={(e) => setReminders({ ...reminders, enabled: e.target.checked })} />
        <Field label={t('billing.reminderDays')} htmlFor="rm-days" hint={t('billing.reminderDaysHelp')}><Input id="rm-days" disabled={!admin} defaultValue={days} key={days} onBlur={(e) => setReminders({ ...reminders, days_after_due: e.target.value.split(',').map((x) => Math.trunc(Number(x.trim()))).filter((n) => Number.isFinite(n) && n > 0) })} /></Field></div>, 'reminders')}
      {ONLINE_PAYMENTS && sectionCard(t('billing.razorpayTitle'), <Checkbox label={t('billing.razorpayEnabled')} disabled={!admin} checked={rzp} onChange={(e) => setRzp(e.target.checked)} />, 'razorpay', t('billing.razorpayHelp'))}
      {admin && <Card className="p-4"><h2 className="font-semibold">{t('billing.occupancy')}</h2><p className="mb-3 text-xs text-slate-500">{t('billing.occupancyHelp')}</p>
        <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={backfill.isPending} onClick={() => backfill.mutate()}>{t('billing.backfill')}</Button>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
          <Field label={t('billing.periodFrom')} htmlFor="rc-from"><Input id="rc-from" type="date" value={reFrom} onChange={(e) => setReFrom(e.target.value)} /></Field>
          <Field label={t('billing.periodTo')} htmlFor="rc-to"><Input id="rc-to" type="date" value={reTo} onChange={(e) => setReTo(e.target.value)} /></Field>
          <Button variant="secondary" loading={recompute.isPending} disabled={!reFrom || !reTo || reTo < reFrom} onClick={() => recompute.mutate()}>{t('billing.recompute')}</Button>
        </div><p className="mt-2 text-xs text-slate-500">{t('billing.recomputeHelp')}</p></Card>}
    </div>
  )
}
