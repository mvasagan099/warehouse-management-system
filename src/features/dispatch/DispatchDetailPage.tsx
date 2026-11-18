import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Circle, Plus, Trash2, Truck } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canOperate } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select } from '../../components/ui/Field'
import { ScannerInput } from '../../components/ui/ScannerInput'
import { SignaturePad } from '../../components/ui/SignaturePad'
import { Badge, Card, ErrorState, PageHeader } from '../../components/ui/misc'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatNumber } from '../../lib/format'
import { isNetworkError } from '../../lib/offline/queue'
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue'
import { supabase } from '../../lib/supabase'
import { Constants, type LabourActivity } from '../../lib/types'
import { normaliseLorry } from '../gate/schema'
import { DISPATCH_TONE } from './DispatchPage'
import { allPicked, matchPick } from './picking'

interface LabourRow { key: string; activity: LabourActivity; packages: string; tonnes: string; workers: string; hours: string; night?: boolean; overtime?: boolean }

export function DispatchDetailPage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const navigate = useNavigate()
  const qc = useQueryClient()
  const offline = useOfflineQueue()
  const { profile } = useAuth()
  const operate = canOperate(profile?.role)
  const [lastScan, setLastScan] = useState<{ ok: boolean; text: string } | null>(null)
  const [gateChoice, setGateChoice] = useState('')
  const [lorry, setLorry] = useState({ number: '', driver: '', phone: '' })
  const [temp, setTemp] = useState('')
  const [seal, setSeal] = useState('')
  const [receiver, setReceiver] = useState('')
  const [signature, setSignature] = useState<Blob | null>(null)
  const [labour, setLabour] = useState<LabourRow[]>([{ key: crypto.randomUUID(), activity: 'LOADING', packages: '', tonnes: '', workers: '', hours: '' }])

  const data = useQuery({
    queryKey: ['dispatch', id],
    queryFn: async () => {
      const r = await supabase.from('dispatch_requests').select('*').eq('id', id).single()
      if (r.error) throw r.error
      const [lines, picks, client, company, gates] = await Promise.all([
        supabase.from('dispatch_request_lines').select('*').eq('request_id', id).is('deleted_at', null).order('line_no'),
        supabase.from('dispatch_picks').select('*').eq('request_id', id).order('pick_seq'),
        supabase.from('clients').select('company_name, pick_rule').eq('id', r.data.client_id).single(),
        supabase.from('company_master').select('name').eq('id', r.data.to_company_id).single(),
        supabase.from('gate_entries').select('id, gate_pass_no, lorry_number, driver_name, status').eq('direction', 'OUTWARD').eq('client_id', r.data.client_id)
          .eq('warehouse_id', r.data.warehouse_id).in('status', ['AT_GATE', 'LOADING']).is('deleted_at', null),
      ])
      if (lines.error) throw lines.error
      return { request: r.data, lines: lines.data, picks: picks.data ?? [], client: client.data, company: company.data, gates: gates.data ?? [] }
    },
  })
  const fail = async (e: unknown) => toast.error(await errorMessage(e))
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['dispatch', id] }); void qc.invalidateQueries({ queryKey: ['dispatch_requests'] }) }

  const scan = useMutation({
    mutationFn: async (code: string) => {
      const picks = data.data!.picks
      const pick = matchPick(picks, code) ?? picks.find((p) => !p.picked)
      if (!pick) throw new Error(t('dispatch.nothingToPick'))
      const queued = async () => { await offline.enqueue('scan', `${(pick as unknown as { slot_code: string }).slot_code} ${code}`, { pick_id: pick.id, code }); return { ...(pick as unknown as { slot_code: string; batch_no: string | null }), queued: true } }
      if (!navigator.onLine) return await queued()
      const { data: res, error } = await supabase.rpc('record_pick_scan', { p_pick_id: pick.id, p_code: code })
      if (error) { if (isNetworkError(error)) return await queued(); throw error }
      return res as unknown as { slot_code: string; batch_no: string | null; queued?: boolean }
    },
    onSuccess: (pick) => { setLastScan({ ok: true, text: pick.queued ? t('offline.scanQueued', { slot: pick.slot_code }) : t('dispatch.scanOk', { slot: pick.slot_code, batch: pick.batch_no ?? '-' }) }); refresh() },
    onError: async (e) => { const m = await errorMessage(e); setLastScan({ ok: false, text: m }); toast.error(m) },
  })
  const onScan = useCallback((code: string) => scan.mutate(code), [scan])

  const confirm = useMutation({
    mutationFn: async () => {
      const { request } = data.data!
      let gateId = gateChoice
      if (!gateId || gateId === 'new') {
        const { data: g, error } = await supabase.from('gate_entries').insert({
          direction: 'OUTWARD', warehouse_id: request.warehouse_id, client_id: request.client_id, company_id: request.to_company_id,
          lorry_number: normaliseLorry(lorry.number), driver_name: lorry.driver || null, driver_phone: lorry.phone || null,
        }).select('id').single()
        if (error) throw error
        gateId = g.id
      }
      let signaturePath: string | undefined
      if (signature) {
        signaturePath = `${request.warehouse_id}/${request.id}/${crypto.randomUUID()}.png`
        const { error } = await supabase.storage.from('signatures').upload(signaturePath, signature, { contentType: 'image/png', upsert: false })
        if (error) throw error
      }
      const { data: challanId, error } = await supabase.rpc('confirm_delivery_challan', {
        p_request_id: request.id, p_gate_entry_id: gateId,
        p_dispatch_temp_c: temp === '' ? undefined : Number(temp), p_seal_number: seal || undefined,
        p_receiver_name: receiver || undefined, p_signature_path: signaturePath,
        p_labour: labour.map((r) => ({ activity: r.activity, packages: Number(r.packages || 0), tonnes: Number(r.tonnes || 0), workers: Number(r.workers), hours: Number(r.hours), is_night: !!r.night, is_overtime: !!r.overtime })),
      })
      if (error) throw error
      return challanId
    },
    onSuccess: () => {
      toast.success(t('dispatch.confirmed'))
      for (const k of ['dispatch', 'dispatch_requests', 'challans', 'stock', 'gate_entries', 'v_zone_slot_summary']) void qc.invalidateQueries({ queryKey: [k] })
      navigate('/challans')
    },
    onError: fail,
  })

  if (data.isPending) return <FullPageSpinner />
  if (data.error || !data.data) return <ErrorState message={t('common.error')} onRetry={() => data.refetch()} retryLabel={t('common.retry')} />
  const { request, lines, picks, client, company, gates } = data.data
  const picking = operate && (request.status === 'APPROVED' || request.status === 'PICKING')
  const ready = allPicked(picks)
  const newLorryOk = normaliseLorry(lorry.number).length >= 4
  const gateOk = gateChoice && gateChoice !== 'new' ? true : newLorryOk
  const labourOk = labour.every((r) => Number(r.workers) >= 1 && r.hours !== '' && Number(r.hours) >= 0)
  const doneCount = picks.filter((p) => p.picked).length

  return (
    <div className="space-y-5">
      <Link to="/dispatch" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" />{t('common.back')}</Link>
      <PageHeader
        title={request.request_no ?? ''}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><Badge tone={DISPATCH_TONE[request.status]}>{t(`dispatchStatus.${request.status}`)}</Badge>{client?.company_name} → {company?.name} · {formatDate(request.requested_date, lang)}</span>}
      />

      <Card>
        <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{t('dispatch.items')}</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between px-4 py-2"><span>{l.line_no}. {l.item_name} {l.sku && <span className="font-mono text-xs text-slate-500">{l.sku}</span>} {l.batch_no && <Badge tone="gray">{l.batch_no}</Badge>}</span><span className="font-medium">{formatNumber(l.quantity, lang, 3)} {l.unit}</span></li>
          ))}
        </ul>
        {request.decision_note && <p className="border-t border-slate-100 px-4 py-2 text-sm text-slate-600">{t('common.reason')}: {request.decision_note}</p>}
      </Card>

      {operate && picks.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">{t('dispatch.pickList')} <span className="ml-2 text-sm font-normal text-slate-500">{t('dispatch.rule', { rule: client?.pick_rule })} · {doneCount}/{picks.length}</span></h2>
          </div>
          {picking && (
            <div className="space-y-2 border-b border-slate-100 p-4">
              <p className="text-sm text-slate-600">{t('dispatch.scanHelp')}</p>
              <ScannerInput onScan={onScan} autoFocus />
              {lastScan && <p className={`rounded-lg p-2 text-sm ${lastScan.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} role={lastScan.ok ? 'status' : 'alert'} data-testid="scan-result">{lastScan.text}</p>}
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {picks.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`pick-${p.pick_seq}`}>
                {p.picked ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label={t('dispatch.picked')} /> : <Circle className="h-5 w-5 text-slate-300" aria-label={t('dispatch.toPick')} />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.item_name} <span className="text-slate-500">{p.batch_no}</span></div>
                  <div className="text-xs text-slate-500">{t('common.slot')}: <span className="font-mono">{p.slot_code}</span>{p.expiry_date && ` · ${t('common.expiry')} ${formatDate(p.expiry_date, lang)}`}</div>
                </div>
                <div className="font-semibold">{formatNumber(p.quantity, lang, 3)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {picking && ready && (
        <Card className="space-y-4 p-4">
          <h2 className="font-semibold">{t('dispatch.challanStep')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('dispatch.lorry')} htmlFor="dc-gate">
              <Select id="dc-gate" value={gateChoice} onChange={(e) => setGateChoice(e.target.value)}>
                <option value="">{t('dispatch.newLorry')}</option>
                {gates.map((g) => <option key={g.id} value={g.id}>{g.gate_pass_no} · {g.lorry_number} {g.driver_name ?? ''}</option>)}
              </Select>
            </Field>
            {(!gateChoice || gateChoice === 'new') && (
              <>
                <Field label={t('gate.lorryNumber')} htmlFor="dc-lorry"><Input id="dc-lorry" className="font-mono uppercase" value={lorry.number} onChange={(e) => setLorry({ ...lorry, number: e.target.value })} /></Field>
                <Field label={t('gate.driverName')} htmlFor="dc-driver" optional><Input id="dc-driver" value={lorry.driver} onChange={(e) => setLorry({ ...lorry, driver: e.target.value })} /></Field>
                <Field label={t('gate.driverPhone')} htmlFor="dc-phone" optional><Input id="dc-phone" type="tel" value={lorry.phone} onChange={(e) => setLorry({ ...lorry, phone: e.target.value })} /></Field>
              </>
            )}
            <Field label={t('dispatch.dispatchTemp')} htmlFor="dc-temp" optional><Input id="dc-temp" inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} /></Field>
            <Field label={t('dispatch.seal')} htmlFor="dc-seal" optional><Input id="dc-seal" value={seal} onChange={(e) => setSeal(e.target.value)} /></Field>
            <Field label={t('dispatch.receiverName')} htmlFor="dc-receiver" optional><Input id="dc-receiver" value={receiver} onChange={(e) => setReceiver(e.target.value)} /></Field>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">{t('dispatch.receiverSignature')}</div>
            <SignaturePad onChange={setSignature} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><div className="text-sm font-medium">{t('dispatch.loadingLabour')}</div>
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setLabour((r) => [...r, { key: crypto.randomUUID(), activity: 'LOADING', packages: '', tonnes: '', workers: '', hours: '' }])}>{t('receive.addLabour')}</Button></div>
            {labour.map((r) => (
              <div key={r.key} className="grid grid-cols-2 gap-2 md:grid-cols-[1.5fr_repeat(4,1fr)_auto]">
                <Select aria-label={t('receive.activity')} value={r.activity} onChange={(e) => setLabour((rs) => rs.map((x) => x.key === r.key ? { ...x, activity: e.target.value as LabourActivity } : x))}>
                  {Constants.public.Enums.labour_activity.map((a) => <option key={a} value={a}>{t(`labourActivity.${a}`)}</option>)}
                </Select>
                {(['packages', 'tonnes', 'workers', 'hours'] as const).map((f) => (
                  <Input key={f} aria-label={t(f === 'packages' ? 'gate.packages' : `receive.${f}`)} placeholder={t(f === 'packages' ? 'gate.packages' : `receive.${f}`)} inputMode="decimal" value={r[f]} onChange={(e) => setLabour((rs) => rs.map((x) => x.key === r.key ? { ...x, [f]: e.target.value } : x))} />
                ))}
                <Button variant="ghost" size="sm" aria-label={t('common.remove')} icon={<Trash2 className="h-4 w-4" />} disabled={labour.length === 1} onClick={() => setLabour((rs) => rs.filter((x) => x.key !== r.key))} />
                <div className="col-span-full flex gap-4">
                  <Checkbox label={t('receive.night')} checked={!!r.night} onChange={(e) => setLabour((rs) => rs.map((x) => x.key === r.key ? { ...x, night: e.target.checked } : x))} />
                  <Checkbox label={t('receive.overtime')} checked={!!r.overtime} onChange={(e) => setLabour((rs) => rs.map((x) => x.key === r.key ? { ...x, overtime: e.target.checked } : x))} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button className="h-12 px-8 text-base" icon={<Truck className="h-5 w-5" />} disabled={!gateOk || !labourOk} loading={confirm.isPending} onClick={() => confirm.mutate()}>{t('dispatch.confirmChallan')}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
