import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canDecide } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { ReasonDialog } from '../../components/ui/ReasonDialog'
import { Badge, Card, ErrorState, PageHeader } from '../../components/ui/misc'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime, formatNumber } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { downloadReceiptPdf } from '../pdf/download'

export function ReceiptDetailPage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const decide = canDecide(profile?.role)
  const qc = useQueryClient()
  const [cancelling, setCancelling] = useState(false)
  const [busy, setBusy] = useState(false)

  const q = useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => {
      const r = await supabase.from('inward_receipts').select('*').eq('id', id).single()
      if (r.error) throw r.error
      const rc = r.data
      const [lines, gate, client, wh, company, labour] = await Promise.all([
        supabase.from('inward_receipt_lines').select('*').eq('receipt_id', id).order('line_no'),
        supabase.from('gate_entries').select('*').eq('id', rc.gate_entry_id).single(),
        supabase.from('clients').select('*').eq('id', rc.client_id).single(),
        supabase.from('warehouses').select('*').eq('id', rc.warehouse_id).single(),
        rc.company_id ? supabase.from('company_master').select('*').eq('id', rc.company_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.from('labour_entries').select('*').eq('document_type', 'INWARD_RECEIPT').eq('document_id', id),
      ])
      if (lines.error) throw lines.error
      if (gate.error) throw gate.error
      return { receipt: rc, lines: lines.data, gate: gate.data, client: client.data, warehouse: wh.data, company: company.data, labour: labour.data ?? [] }
    },
  })

  const cancel = useMutation({
    mutationFn: async (reason: string) => { const { error } = await supabase.rpc('cancel_inward_receipt', { p_receipt_id: id, p_reason: reason }); if (error) throw error },
    onSuccess: () => {
      toast.success(t('receipts.cancelled')); setCancelling(false)
      for (const k of ['receipt', 'receipts', 'stock', 'gate_entries', 'v_zone_slot_summary']) void qc.invalidateQueries({ queryKey: [k] })
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  if (q.isPending) return <FullPageSpinner />
  if (q.error || !q.data) return <ErrorState message={t('common.error')} onRetry={() => q.refetch()} retryLabel={t('common.retry')} />
  const { receipt, lines, gate, client, warehouse, company, labour } = q.data

  const download = async () => {
    setBusy(true)
    try { await downloadReceiptPdf({ receipt, lines, warehouse, client, company, gate }) }
    catch (e) { toast.error(await errorMessage(e)) }
    finally { setBusy(false) }
  }
  const kv = (label: string, value: React.ReactNode) => <div><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="text-sm font-medium">{value ?? '—'}</dd></div>

  return (
    <div className="space-y-5">
      <Link to="/receipts" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" />{t('common.back')}</Link>
      <PageHeader
        title={receipt.receipt_no}
        subtitle={<Badge tone={receipt.status === 'CONFIRMED' ? 'green' : 'red'}>{t(`docStatus.${receipt.status}`)}</Badge>}
        actions={
          <>
            <Button icon={<Download className="h-4 w-4" />} loading={busy} onClick={download}>{t('common.downloadPdf')}</Button>
            {decide && receipt.status === 'CONFIRMED' && <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setCancelling(true)}>{t('common.cancelDoc')}</Button>}
          </>
        }
      />
      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kv(t('common.client'), client?.company_name)}
          {kv(t('gate.fromCompany'), company?.name)}
          {kv(t('common.warehouse'), warehouse ? `${warehouse.code} · ${warehouse.name}` : null)}
          {kv(t('receipts.receivedAt'), formatDateTime(receipt.received_at, lang))}
          {kv(t('gate.lorryNumber'), gate.lorry_number)}
          {kv(t('gate.driverName'), [gate.driver_name, gate.driver_phone].filter(Boolean).join(' · '))}
          {kv(t('gate.ewayBill'), gate.eway_bill_number)}
          {kv(t('gate.sealArrival'), gate.seal_number_arrival)}
          {kv(t('gate.lorryTemp'), gate.lorry_temp_c !== null ? `${gate.lorry_temp_c} °C` : null)}
          {kv(t('gate.passNo'), <Link className="text-brand-700 hover:underline" to={`/gate/${gate.id}`}>{gate.gate_pass_no}</Link>)}
        </dl>
        {receipt.remarks && <p className="mt-3 text-sm">{receipt.remarks}</p>}
        {receipt.cancel_reason && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{t('common.reason')}: {receipt.cancel_reason}</p>}
      </Card>
      <Card>
        <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">{t('gate.loadLines')}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">{t('common.item')}</th><th className="px-4 py-2">{t('common.batch')}</th><th className="px-4 py-2">{t('common.expiry')}</th>
                <th className="px-4 py-2">{t('gate.declaredQty')}</th><th className="px-4 py-2">{t('receive.accepted')}</th><th className="px-4 py-2">{t('receive.short')}</th><th className="px-4 py-2">{t('receive.damaged')}</th><th className="px-4 py-2">{t('common.slot')}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2">{l.line_no}</td>
                  <td className="px-4 py-2 font-medium">{l.item_name}{l.sku && <span className="block font-mono text-xs text-slate-500">{l.sku}</span>}</td>
                  <td className="px-4 py-2">{l.batch_no ?? '—'}</td>
                  <td className="px-4 py-2">{l.expiry_date ? formatDate(l.expiry_date, lang) : '—'}</td>
                  <td className="px-4 py-2">{formatNumber(l.declared_qty, lang, 3)} {l.unit}</td>
                  <td className="px-4 py-2">{formatNumber(l.accepted_qty, lang, 3)}</td>
                  <td className="px-4 py-2">{l.short_qty > 0 ? <Badge tone="amber">{formatNumber(l.short_qty, lang, 3)}</Badge> : '0'}</td>
                  <td className="px-4 py-2">{l.damaged_qty > 0 ? <Badge tone="red">{formatNumber(l.damaged_qty, lang, 3)}</Badge> : '0'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{l.slot_codes.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {labour.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">{t('receive.labourStep')}</h2>
          <ul className="text-sm">
            {labour.map((l) => <li key={l.id} className={l.cancelled ? 'text-slate-400 line-through' : ''}>{t(`labourActivity.${l.activity}`)} · {l.packages} {t('gate.packages').toLowerCase()} · {l.tonnes} t · {l.workers} {t('receive.workers').toLowerCase()} · {l.hours} h</li>)}
          </ul>
        </Card>
      )}
      <ReasonDialog open={cancelling} title={t('receipts.cancelTitle')} message={t('receipts.cancelHelp')} loading={cancel.isPending} onConfirm={(r) => cancel.mutate(r)} onClose={() => setCancelling(false)} />
    </div>
  )
}
