import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../lib/errors'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { saveBlob } from '../pdf/download'
import { buildPdf, docFileName } from '../portal/documents'
import { useSetting } from '../shared/queries'

interface Billed { invoice_id: string; invoice_no: string; due_paise: number; period_from: string; period_to: string }

/** After a dispatch: invoice everything finished for this client, take the cash, hand over the invoice PDF. Administrator only. */
export function BillDialog({ clientId, warehouseId, clientName, onClose }: { clientId: string; warehouseId: string; clientName: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const terms = useSetting<string>('invoice_terms', '')
  const [billed, setBilled] = useState<Billed | null>(null)
  const [paid, setPaid] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [reference, setReference] = useState('')
  const bill = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc('quick_bill', { p_client_id: clientId, p_warehouse_id: warehouseId }); if (error) throw error; return data as unknown as Billed },
    onSuccess: (b) => { setBilled(b); setAmount((b.due_paise / 100).toFixed(2)); void qc.invalidateQueries({ queryKey: ['invoices'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const pay = useMutation({
    mutationFn: async () => {
      const paise = Math.round(Number(amount) * 100)
      const { error } = await supabase.rpc('record_payment', { p_client_id: clientId, p_warehouse_id: warehouseId, p_amount_paise: paise, p_method: method as 'CASH', p_reference: reference, p_paid_on: new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10), p_invoice_id: billed!.invoice_id })
      if (error) throw error
    },
    onSuccess: () => { setPaid(true); toast.success(t('quickBill.paidDone')); void qc.invalidateQueries({ queryKey: ['payments'] }); void qc.invalidateQueries({ queryKey: ['invoices'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const download = async () => {
    try { const doc = { kind: 'INVOICE' as const, id: billed!.invoice_id, no: billed!.invoice_no, date: '' }; saveBlob(await buildPdf(doc, clientId, '', '', terms.data), docFileName(doc)) } catch (e) { toast.error(await errorMessage(e)) }
  }
  const valid = Number(amount) > 0
  return (
    <Modal open title={t('quickBill.title', { name: clientName })} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>
      <div className="space-y-4 text-sm">
        {!billed ? (<>
          <p className="text-slate-600">{t('quickBill.help')}</p>
          <Button loading={bill.isPending} onClick={() => bill.mutate()} data-testid="quick-bill-go">{t('quickBill.calculate')}</Button>
        </>) : (<>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{t('quickBill.invoice')}</div><div className="text-lg font-semibold">{billed.invoice_no}</div>
            <div className="text-slate-600">{t('quickBill.period', { from: billed.period_from, to: billed.period_to })}</div><div className="mt-1 text-xl font-semibold" data-testid="quick-bill-due">{formatINR(billed.due_paise)}</div></div>
          {!paid ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('quickBill.amount')} htmlFor="qb-amt"><Input id="qb-amt" className="h-12 text-base" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label={t('quickBill.method')} htmlFor="qb-method"><Select id="qb-method" value={method} onChange={(e) => setMethod(e.target.value)}>{['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'].map((m) => <option key={m} value={m}>{t(`quickBill.methods.${m}`)}</option>)}</Select></Field>
              <Field label={t('quickBill.reference')} htmlFor="qb-ref" optional><Input id="qb-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
              <div className="sm:col-span-3"><Button loading={pay.isPending} disabled={!valid} onClick={() => pay.mutate()} data-testid="quick-bill-pay">{t('quickBill.collect')}</Button></div>
            </div>) : <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{t('quickBill.recorded')}</p>}
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={download}>{t('quickBill.downloadInvoice')}</Button>
        </>)}
        <p className="text-xs text-slate-500">{t('quickBill.note')}</p>
      </div>
    </Modal>
  )
}
