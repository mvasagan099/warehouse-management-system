import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Check, FileDown, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canDecide, canOperate } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Alert } from '../../lib/types'
import { downloadEvidencePackPdf } from '../pdf/download'
import { useZones, useWarehouses } from '../shared/queries'
import { ResolveDialog, refreshAlerts, useAcknowledge } from './AlertDialogs'
import { ageText } from './common'
import { useNow } from './queries'

export const SEVERITY_TONE = { CRITICAL: 'red', WARNING: 'amber' } as const

export function AlertBadges({ a }: { a: Alert }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={SEVERITY_TONE[a.severity]}>{t(`cold.severity.${a.severity}`)}</Badge>
      <Badge tone={a.status === 'RESOLVED' ? 'green' : a.status === 'ACKNOWLEDGED' ? 'blue' : 'gray'}>{t(`cold.alertStatus.${a.status}`)}</Badge>
      {a.recovered_at && a.status !== 'RESOLVED' && <Badge tone="cyan">{t('cold.recovered')}</Badge>}
    </span>
  )
}

/** A readable list of open alerts with the acknowledge / resolve / open actions (used on the live dashboard and on the alerts page). */
export function AlertRows({ alerts, onOpen, compact }: { alerts: Alert[]; onOpen: (a: Alert) => void; compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const now = useNow()
  const zones = useZones()
  const ack = useAcknowledge()
  const [resolving, setResolving] = useState<Alert | null>(null)
  const zoneName = new Map((zones.data ?? []).map((z) => [z.id, `${z.code} · ${z.name}`]))
  if (!alerts.length) return <p className="p-4 text-sm text-slate-500">{t('cold.noAlerts')}</p>
  return (
    <ul className="divide-y divide-slate-100">
      {alerts.map((a) => (
        <li key={a.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="alert-row">
          <button className="text-left" onClick={() => onOpen(a)}>
            <div className="flex flex-wrap items-center gap-2"><AlertBadges a={a} /><span className="font-medium">{t(`cold.kind.${a.kind}`)}</span><span className="text-sm text-slate-500">{zoneName.get(a.zone_id)}</span></div>
            <div className="text-xs text-slate-500">
              {t('cold.since')} {formatDateTime(a.event_start, i18n.resolvedLanguage)} · {a.duration_min} min{a.peak_value !== null ? ` · ${t('cold.peak')} ${formatNumber(a.peak_value, i18n.resolvedLanguage, 1)} °C` : ''}
              {!a.recovered_at && ` · ${t('cold.stillActive')}`} · {t('cold.updated')} {ageText(a.updated_at, now)}
            </div>
          </button>
          {!compact && (
            <div className="flex gap-2">
              {a.status === 'OPEN' && canOperate(profile?.role) && <Button size="sm" variant="secondary" icon={<Check className="h-4 w-4" />} loading={ack.isPending && ack.variables === a.id} onClick={() => ack.mutate(a.id)}>{t('cold.acknowledge')}</Button>}
              {a.status !== 'RESOLVED' && canDecide(profile?.role) && <Button size="sm" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setResolving(a)}>{t('cold.resolve')}</Button>}
            </div>
          )}
        </li>
      ))}
      {resolving && <ResolveDialog alert={resolving} onClose={() => setResolving(null)} />}
    </ul>
  )
}

/** Everything about one alert: timeline, affected stock, client notices (manager approves the wording) and the evidence pack PDF. */
export function AlertDetail({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const { profile } = useAuth()
  const zones = useZones(); const whs = useWarehouses()
  const [resolving, setResolving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<{ id: string; subject: string; body: string } | null>(null)
  const ack = useAcknowledge()
  const d = useQuery({
    queryKey: ['alert_detail', alertId],
    queryFn: async () => {
      const [a, st, ev, no] = await Promise.all([
        supabase.from('alerts').select('*').eq('id', alertId).single(),
        supabase.from('alert_stock').select('*').eq('alert_id', alertId).order('client_name'),
        supabase.from('alert_evidence').select('*').eq('alert_id', alertId).order('recorded_at'),
        supabase.from('client_notices').select('*').eq('alert_id', alertId),
      ])
      for (const r of [a, st, ev, no]) if (r.error) throw r.error
      const sensor = a.data!.sensor_id ? (await supabase.from('sensors').select('*').eq('id', a.data!.sensor_id).maybeSingle()).data : null
      return { alert: a.data!, stock: st.data!, evidence: ev.data!, notices: no.data!, sensor }
    },
  })
  const decideNotice = useMutation({
    mutationFn: async ({ id, approve, subject, body }: { id: string; approve: boolean; subject?: string; body?: string }) => {
      const { error } = approve ? await supabase.rpc('approve_client_notice', { p_notice_id: id, p_subject: subject, p_body: body }) : await supabase.rpc('reject_client_notice', { p_notice_id: id })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('common.saved')); setEditing(null); refreshAlerts(qc) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const a = d.data?.alert
  const zone = zones.data?.find((z) => z.id === a?.zone_id)
  const wh = whs.data?.find((w) => w.id === a?.warehouse_id)
  const clientName = new Map((d.data?.stock ?? []).map((s) => [s.client_id, s.client_name]))
  const pack = async () => {
    if (!d.data || !a) return
    setBusy(true)
    try { await downloadEvidencePackPdf({ alert: a, zone: zone ?? null, warehouse: wh ?? null, sensor: d.data.sensor, evidence: d.data.evidence, stock: d.data.stock, notices: d.data.notices, clientNames: Object.fromEntries(clientName) }) }
    catch (e) { toast.error(await errorMessage(e)) } finally { setBusy(false) }
  }
  const events: [string | null, string][] = a ? [[a.event_start, t('cold.evStart')], [a.opened_at, t('cold.evOpened')], [a.escalation_level > 0 ? a.escalated_at : null, t('cold.evEscalated', { level: a.escalation_level })],
    [a.acknowledged_at, t('cold.evAck')], [a.recovered_at, t('cold.evRecovered')], [a.resolved_at, t('cold.evResolved')]] : []
  return (
    <Modal open size="lg" title={a ? `${t(`cold.kind.${a.kind}`)} · ${zone?.code ?? ''}` : t('cold.alert')} onClose={onClose} footer={a && (
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} loading={busy} onClick={pack}>{t('cold.evidencePack')}</Button>
        {a.status === 'OPEN' && canOperate(profile?.role) && <Button variant="secondary" onClick={() => ack.mutate(a.id, { onSuccess: () => void d.refetch() })}>{t('cold.acknowledge')}</Button>}
        {a.status !== 'RESOLVED' && canDecide(profile?.role) && <Button onClick={() => setResolving(true)}>{t('cold.resolve')}</Button>}
      </div>)}>
      {d.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : !a ? <p>{t('common.error')}</p> : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2"><AlertBadges a={a} /><span className="text-slate-500">{wh?.name} · {zone?.name} · {d.data?.sensor?.name ?? '—'}</span></div>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[[t('cold.peakValue'), a.peak_value !== null ? `${a.peak_value} °C` : '—'], [t('cold.peakDeviation'), `${a.peak_deviation} °C`], [t('cold.duration'), `${a.duration_min} min`], [t('cold.limit'), a.limit_value !== null ? `${a.limit_value} °C` : '—']].map(([k, v]) =>
              <div key={k}><dt className="text-xs uppercase text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
          <section><h3 className="mb-1 font-semibold">{t('cold.timeline')}</h3>
            <ol className="space-y-0.5">{events.filter(([ts]) => ts).map(([ts, label]) => <li key={label}><span className="text-slate-500">{formatDateTime(ts, lang)}</span> · {label}</li>)}</ol></section>
          {a.status === 'RESOLVED' && <p className="rounded-lg bg-emerald-50 p-2"><b>{t('cold.cause')}:</b> {a.cause}<br /><b>{t('cold.actionTaken')}:</b> {a.action_taken}</p>}
          <section><h3 className="mb-1 font-semibold">{t('cold.affectedStock')}</h3>
            {d.data!.stock.length === 0 ? <p className="text-slate-500">{t('cold.noAffected')}</p> : (
              <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full text-xs" data-testid="affected-stock">
                <thead className="bg-slate-50 text-left uppercase text-slate-500"><tr><th className="px-2 py-1.5">{t('common.client')}</th><th className="px-2 py-1.5">{t('common.slot')}</th><th className="px-2 py-1.5">{t('common.item')}</th><th className="px-2 py-1.5">{t('common.batch')}</th><th className="px-2 py-1.5 text-right">{t('common.quantity')}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{d.data!.stock.map((s) => <tr key={s.id}><td className="px-2 py-1.5">{s.client_name}</td><td className="px-2 py-1.5 font-mono">{s.slot_code}</td><td className="px-2 py-1.5">{s.item_name ?? '—'}</td><td className="px-2 py-1.5">{s.batch_no ?? '—'}</td><td className="px-2 py-1.5 text-right">{s.quantity !== null ? `${s.quantity} ${s.unit ?? ''}` : '—'}</td></tr>)}</tbody></table></div>)}
          </section>
          {d.data!.notices.length > 0 && <section><h3 className="mb-1 font-semibold">{t('cold.clientNotices')}</h3>
            <ul className="space-y-2">{d.data!.notices.map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-200 p-2" data-testid="client-notice">
                <div className="flex items-center justify-between"><span className="font-medium">{clientName.get(n.client_id) ?? n.client_id}</span><Badge tone={n.status === 'APPROVED' ? 'green' : n.status === 'REJECTED' ? 'red' : 'amber'}>{t(`cold.noticeStatus.${n.status}`)}</Badge></div>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">{n.body}</p>
                {n.status === 'DRAFT' && canDecide(profile?.role) && <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => setEditing({ id: n.id, subject: n.subject, body: n.body })}>{t('cold.reviewApprove')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => decideNotice.mutate({ id: n.id, approve: false })}>{t('cold.rejectNotice')}</Button></div>}
              </li>))}</ul><p className="mt-1 text-xs text-slate-500">{t('cold.noticeHelp')}</p></section>}
        </div>)}
      {resolving && a && <ResolveDialog alert={a} onClose={() => { setResolving(false); void d.refetch() }} />}
      {editing && <Modal open title={t('cold.reviewApprove')} onClose={() => setEditing(null)} footer={<><Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
        <Button loading={decideNotice.isPending} onClick={() => decideNotice.mutate({ id: editing.id, approve: true, subject: editing.subject, body: editing.body })}>{t('cold.approveSend')}</Button></>}>
        <div className="space-y-3"><Field label={t('cold.subject')} htmlFor="cn-subject"><Input id="cn-subject" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></Field>
          <Field label={t('cold.message')} htmlFor="cn-body"><Textarea id="cn-body" rows={6} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></Field></div></Modal>}
    </Modal>
  )
}
