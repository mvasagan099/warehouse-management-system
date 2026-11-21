import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, Download, Eye, PenLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canDecide, canOperate } from '../../auth/roles'
import { BillDialog } from './BillDialog'
import { CrewPanel } from '../attendance/CrewPanel'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ReasonDialog } from '../../components/ui/ReasonDialog'
import { SignaturePad } from '../../components/ui/SignaturePad'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime, formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { DeliveryChallan } from '../../lib/types'
import { downloadChallanPdf } from '../pdf/download'
import { useClients, useWarehouses } from '../shared/queries'

function ChallanDetail({ challan, onClose }: { challan: DeliveryChallan; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const decide = canDecide(profile?.role)
  const operate = canOperate(profile?.role)
  const qc = useQueryClient()
  const [cancelling, setCancelling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [signing, setSigning] = useState(false)
  const [billing, setBilling] = useState(false)
  const [sig, setSig] = useState<Blob | null>(null)
  const [receiver, setReceiver] = useState(challan.receiver_name ?? '')

  const detail = useQuery({
    queryKey: ['challan', challan.id],
    queryFn: async () => {
      const [lines, client, wh, company, gate] = await Promise.all([
        supabase.from('delivery_challan_lines').select('*').eq('challan_id', challan.id).order('line_no'),
        supabase.from('clients').select('*').eq('id', challan.client_id).single(),
        supabase.from('warehouses').select('*').eq('id', challan.warehouse_id).single(),
        supabase.from('company_master').select('*').eq('id', challan.to_company_id).single(),
        supabase.from('gate_entries').select('*').eq('id', challan.gate_entry_id).maybeSingle(),
      ])
      if (lines.error) throw lines.error
      return { lines: lines.data, client: client.data, warehouse: wh.data, toCompany: company.data, gate: gate.data }
    },
  })
  const refresh = () => { for (const k of ['challans', 'challan', 'stock', 'dispatch_requests', 'gate_entries', 'v_zone_slot_summary']) void qc.invalidateQueries({ queryKey: [k] }) }

  const cancel = useMutation({
    mutationFn: async (reason: string) => { const { error } = await supabase.rpc('cancel_delivery_challan', { p_challan_id: challan.id, p_reason: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('challans.cancelled')); setCancelling(false); refresh(); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const savePod = useMutation({
    mutationFn: async () => {
      if (!sig) throw new Error(t('challans.signatureHere'))
      const path = `${challan.warehouse_id}/pod/${crypto.randomUUID()}.png`
      const up = await supabase.storage.from('signatures').upload(path, sig, { contentType: 'image/png', upsert: false })
      if (up.error) throw up.error
      const { error } = await supabase.rpc('record_challan_pod', { p_challan_id: challan.id, p_receiver_name: receiver, p_signature_path: path })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('challans.podSaved')); setSigning(false); refresh() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const download = async () => {
    if (!detail.data) return
    setBusy(true)
    try {
      const { lines, client, warehouse, toCompany, gate } = detail.data
      await downloadChallanPdf({ challan, lines, client, warehouse, toCompany, gate })
    } catch (e) { toast.error(await errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open size="lg" title={`${challan.challan_no}`} onClose={onClose} footer={
      <>
        {profile?.role === 'SUPER_ADMIN' && challan.status === 'CONFIRMED' && <Button variant="secondary" onClick={() => setBilling(true)} data-testid="bill-collect">{t('quickBill.button')}</Button>}
        {decide && challan.status === 'CONFIRMED' && <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelling(true)}>{t('common.cancelDoc')}</Button>}
        <Button icon={<Download className="h-4 w-4" />} loading={busy} disabled={!detail.data} onClick={download}>{t('common.downloadPdf')}</Button>
      </>
    }>
      {detail.isPending ? <div className="flex justify-center p-8"><Spinner /></div> : detail.data && (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div><dt className="text-xs text-slate-500">{t('common.client')}</dt><dd className="font-medium">{detail.data.client?.company_name}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('gate.toCompany')}</dt><dd className="font-medium">{detail.data.toCompany?.name}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('challans.dispatchedAt')}</dt><dd className="font-medium">{formatDateTime(challan.dispatched_at, lang)}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('gate.lorryNumber')}</dt><dd className="font-medium">{detail.data.gate?.lorry_number} {detail.data.gate?.driver_name}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('dispatch.seal')}</dt><dd className="font-medium">{challan.seal_number ?? '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('dispatch.dispatchTemp')}</dt><dd className="font-medium">{challan.dispatch_temp_c !== null ? `${challan.dispatch_temp_c} °C` : '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('gate.ewayBill')}</dt><dd className="font-medium">{detail.data.gate?.eway_bill_number ?? '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('dispatch.receiverName')}</dt><dd className="font-medium">{challan.receiver_name ?? '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('challans.pod')}</dt><dd>{challan.signature_path ? <Badge tone="green">{t('challans.signed')} {challan.pod_signed_at ? formatDateTime(challan.pod_signed_at, lang) : ''}</Badge> : <Badge tone="amber">{t('challans.notSigned')}</Badge>}</dd></div>
          </dl>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">{t('common.item')}</th><th className="px-3 py-2">{t('common.batch')}</th><th className="px-3 py-2">{t('common.expiry')}</th><th className="px-3 py-2">{t('common.quantity')}</th><th className="px-3 py-2">{t('common.slot')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {detail.data.lines.map((l) => (
                <tr key={l.id}><td className="px-3 py-2">{l.line_no}</td><td className="px-3 py-2 font-medium">{l.item_name}</td><td className="px-3 py-2">{l.batch_no ?? '—'}</td><td className="px-3 py-2">{l.expiry_date ? formatDate(l.expiry_date, lang) : '—'}</td><td className="px-3 py-2">{formatNumber(l.quantity, lang, 3)} {l.unit}</td><td className="px-3 py-2 font-mono text-xs">{l.slot_code}</td></tr>
              ))}
            </tbody>
          </table>
          {operate && <CrewPanel documentType="DELIVERY_CHALLAN" documentId={challan.id} warehouseId={challan.warehouse_id} at={challan.dispatched_at} editable={challan.status === 'CONFIRMED'} />}
          {challan.cancel_reason && <p className="rounded-lg bg-red-50 p-2 text-red-700">{t('common.reason')}: {challan.cancel_reason}</p>}
          {operate && challan.status === 'CONFIRMED' && !challan.signature_path && (
            signing ? (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <Input aria-label={t('dispatch.receiverName')} placeholder={t('dispatch.receiverName')} value={receiver} onChange={(e) => setReceiver(e.target.value)} />
                <SignaturePad onChange={setSig} />
                <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setSigning(false)}>{t('common.cancel')}</Button><Button loading={savePod.isPending} disabled={!sig} onClick={() => savePod.mutate()}>{t('common.save')}</Button></div>
              </div>
            ) : <Button variant="secondary" icon={<PenLine className="h-4 w-4" />} onClick={() => setSigning(true)}>{t('challans.captureSignature')}</Button>
          )}
        </div>
      )}
      {billing && <BillDialog clientId={challan.client_id} warehouseId={challan.warehouse_id} clientName={detail.data?.client?.company_name ?? ''} onClose={() => setBilling(false)} />}
      <ReasonDialog open={cancelling} title={t('challans.cancelTitle')} message={t('challans.cancelHelp')} loading={cancel.isPending} onConfirm={(r) => cancel.mutate(r)} onClose={() => setCancelling(false)} />
    </Modal>
  )
}

export function ChallansPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const [params, setParams] = useSearchParams()
  const clients = useClients()
  const warehouses = useWarehouses()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const list = useQuery({
    queryKey: ['challans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_challans').select('*').is('deleted_at', null).order('dispatched_at', { ascending: false }).limit(500)
      if (error) throw error
      return data
    },
  })
  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const whName = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, w.code])), [warehouses.data])
  const rows = useMemo(() => (list.data ?? []).filter((c) => !status || c.status === status), [list.data, status])
  const selected = list.data?.find((c) => c.id === params.get('id')) ?? null

  const columns = useMemo<ColumnDef<DeliveryChallan>[]>(() => [
    { accessorKey: 'challan_no', header: t('challans.no'), cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: 'dispatched_at', header: t('challans.dispatchedAt'), cell: (c) => formatDateTime(c.getValue<string>(), lang) },
    ...(!isClient ? [{ id: 'client', header: t('common.client'), accessorFn: (r: DeliveryChallan) => clientName.get(r.client_id) ?? '' } satisfies ColumnDef<DeliveryChallan>] : []),
    { id: 'wh', header: t('common.warehouse'), accessorFn: (r) => whName.get(r.warehouse_id) ?? '' },
    { accessorKey: 'seal_number', header: t('dispatch.seal'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { id: 'pod', header: t('challans.pod'), cell: (c) => c.row.original.signature_path ? <Badge tone="green">{t('challans.signed')}</Badge> : <Badge tone="amber">{t('challans.notSigned')}</Badge> },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={c.getValue() === 'CONFIRMED' ? 'green' : 'red'}>{t(`docStatus.${c.getValue<string>()}`)}</Badge> },
    { id: 'open', header: '', cell: ({ row }) => <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setParams({ id: row.original.id })}>{t('common.view')}</Button> },
  ], [t, lang, isClient, clientName, whName, setParams])

  return (
    <div>
      <PageHeader title={t('challans.title')} />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('common.search')} />
          <Select aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="">{t('common.all')}</option>
            <option value="CONFIRMED">{t('docStatus.CONFIRMED')}</option>
            <option value="CANCELLED">{t('docStatus.CANCELLED')}</option>
          </Select>
        </Toolbar>
        <DataTable data={rows} columns={columns} loading={list.isPending || clients.isPending} error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()} search={search} filtered={!!status} emptyMessage={t('challans.empty')} />
      </Card>
      {selected && <ChallanDetail challan={selected} onClose={() => setParams({})} />}
    </div>
  )
}
