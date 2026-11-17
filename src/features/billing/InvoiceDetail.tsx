import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Braces, Download, FilePlus2, Link2, Mail, Pencil, Plus, Send, Trash2, Wallet } from 'lucide-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { canWrite } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { ReasonDialog } from '../../components/ui/ReasonDialog'
import { Badge } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatNumber } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import type { InvoiceLine, InvoiceSection } from '../../lib/types'
import { bpToPercent } from '../../lib/words'
import { downloadInvoicePdf, invoicePdfBlob } from '../pdf/download'
import { useSetting } from '../shared/queries'
import { STATUS_TONE, downloadText, owed } from './common'
import { AddChargeDialog, FixLineDialog, NoteDialog, PaymentDialog, refreshBilling } from './InvoiceDialogs'
import { useInvoiceDetail } from './queries'

const SECTIONS: InvoiceSection[] = ['RENT', 'LABOUR', 'OTHER']

export function InvoiceDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const { profile } = useAuth()
  const admin = canWrite(profile?.role, 'invoices')
  const detail = useInvoiceDetail(id)
  const terms = useSetting<string>('invoice_terms', '')
  const emailFlag = useSetting<{ enabled?: boolean }>('email', {})
  const rzpFlag = useSetting<{ enabled?: boolean }>('razorpay', {})
  const [fix, setFix] = useState<InvoiceLine | null>(null)
  const [removing, setRemoving] = useState<InvoiceLine | null>(null)
  const [adding, setAdding] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [noting, setNoting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payLink, setPayLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const inv = detail.data?.invoice
  const isDraft = inv?.status === 'DRAFT'

  const remove = useMutation({
    mutationFn: async (reason: string) => { const { error } = await supabase.rpc('remove_invoice_line', { p_line_id: removing!.id, p_reason: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('billing.lineRemoved')); setRemoving(null); refreshBilling(qc) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const discard = useMutation({
    mutationFn: async (reason: string) => { const { error } = await supabase.rpc('discard_draft_invoice', { p_invoice_id: id, p_reason: reason }); if (error) throw error },
    onSuccess: () => { toast.success(t('billing.draftDiscarded')); setDiscarding(false); refreshBilling(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  const issue = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc('issue_invoice', { p_invoice_id: id }); if (error) throw error; return data },
    onSuccess: (no) => { toast.success(t('billing.issued', { no })); setIssuing(false); refreshBilling(qc) },
    onError: async (e) => { setIssuing(false); toast.error(await errorMessage(e)) },
  })

  const pdfData = () => ({ invoice: inv!, lines: detail.data!.lines, tax: detail.data!.tax, terms: terms.data, watermark: isDraft ? 'DRAFT' : null })
  const wrap = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } catch (e) { toast.error(await errorMessage(e)) } finally { setBusy(false) } }
  const download = () => wrap(() => downloadInvoicePdf(pdfData()))
  const einvoice = () => wrap(async () => {
    const { data, error } = await supabase.rpc('einvoice_json', { p_invoice_id: id })
    if (error) throw error
    downloadText(`${(inv!.invoice_no ?? 'invoice').replace(/[^A-Za-z0-9._-]+/g, '-')}-einvoice.json`, JSON.stringify([data], null, 2), 'application/json')
  })
  const email = (link?: string) => wrap(async () => {
    const blob = await invoicePdfBlob(pdfData())
    const path = `${inv!.warehouse_id}/${inv!.id}.pdf`
    const up = await supabase.storage.from('invoices').upload(path, blob, { contentType: 'application/pdf', upsert: true })
    if (up.error) throw up.error
    const { data, error } = await supabase.functions.invoke('send-invoice', { body: { invoice_id: id, pay_link: link } })
    if (error) throw error
    toast.success(t('billing.emailSent', { to: (data as { sent_to: string }).sent_to })); refreshBilling(qc)
  })
  const makeLink = () => wrap(async () => {
    const { data, error } = await supabase.functions.invoke('razorpay-link', { body: { invoice_id: id } })
    if (error) throw error
    setPayLink((data as { short_url: string }).short_url)
  })

  const header = (k: string, v: string) => <div><dt className="text-xs uppercase text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>
  const totalRows: [string, number][] = inv ? [[t('billing.taxable'), inv.taxable_paise], ['CGST', inv.cgst_paise], ['SGST', inv.sgst_paise], ['IGST', inv.igst_paise], [t('billing.roundOff'), inv.round_off_paise]] : []

  return (
    <Modal open size="lg" title={inv?.invoice_no ?? t('billing.draftInvoice')} onClose={onClose} footer={inv && (
      <div className="flex flex-wrap justify-end gap-2">
        {admin && isDraft && <>
          <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDiscarding(true)}>{t('billing.discard')}</Button>
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>{t('billing.addCharge')}</Button>
        </>}
        {!isDraft && admin && inv.status !== 'CANCELLED' && <>
          <Button variant="secondary" icon={<FilePlus2 className="h-4 w-4" />} onClick={() => setNoting(true)}>{t('billing.newNote')}</Button>
          {owed(inv) > 0 && <Button variant="secondary" icon={<Wallet className="h-4 w-4" />} onClick={() => setPaying(true)}>{t('billing.recordPayment')}</Button>}
          {emailFlag.data?.enabled && <Button variant="secondary" icon={<Mail className="h-4 w-4" />} loading={busy} onClick={() => email()}>{t('billing.sendEmail')}</Button>}
          {rzpFlag.data?.enabled && owed(inv) > 0 && <Button variant="secondary" icon={<Link2 className="h-4 w-4" />} loading={busy} onClick={makeLink}>{t('billing.paymentLink')}</Button>}
        </>}
        {!isDraft && !!profile && profile.role !== 'CLIENT' && inv.status !== 'CANCELLED' && <Button variant="secondary" icon={<Braces className="h-4 w-4" />} loading={busy} onClick={einvoice}>{t('billing.einvoiceJson')}</Button>}
        <Button variant={isDraft ? 'secondary' : 'primary'} icon={<Download className="h-4 w-4" />} loading={busy} onClick={download}>{t('common.downloadPdf')}</Button>
        {admin && isDraft && <Button icon={<Send className="h-4 w-4" />} onClick={() => setIssuing(true)}>{t('billing.issue')}</Button>}
      </div>
    )}>
      {detail.isPending ? <div className="flex justify-center p-8"><Spinner /></div> : !detail.data || !inv ? <p>{t('common.error')}</p> : (
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {header(t('billing.period'), `${formatDate(inv.period_from, lang)} – ${formatDate(inv.period_to, lang)}`)}
            {header(t('billing.invoiceDate'), formatDate(inv.invoice_date, lang))}
            {header(t('billing.dueDate'), formatDate(inv.due_date, lang))}
            {header(t('billing.placeOfSupply'), `${inv.place_of_supply ?? '—'} · ${t(`billing.supply${inv.supply_kind}`)}`)}
            {header(t('billing.outstanding'), formatINR(owed(inv)))}
            {header(t('billing.paid'), formatINR(inv.paid_paise))}
            {header(t('billing.credits'), formatINR(inv.credit_paise))}
          </dl>
          <div><Badge tone={STATUS_TONE[inv.status]}>{t(`invoiceStatus.${inv.status}`)}</Badge></div>
          {isDraft && <p className="rounded-lg bg-amber-50 p-2 text-amber-800">{t('billing.draftHelp')}</p>}

          {SECTIONS.map((sec) => {
            const rows = detail.data.lines.filter((l) => l.section === sec)
            if (!rows.length) return null
            const subtotal = rows.reduce((a, l) => a + l.taxable_paise, 0)
            return (
              <section key={sec}>
                <h3 className="mb-1 font-semibold">{t(`billing.section${sec}`)}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-left uppercase text-slate-500"><tr>
                      <th className="px-2 py-1.5">{t('billing.description')}</th><th className="px-2 py-1.5 text-right">{t('common.quantity')}</th><th className="px-2 py-1.5 text-right">{t('billing.rate')}</th>
                      <th className="px-2 py-1.5 text-right">{t('billing.discount')}</th><th className="px-2 py-1.5 text-right">{t('billing.taxable')}</th>{admin && isDraft && <th />}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((l) => (
                        <Fragment key={l.id}>
                          <tr className="align-top">
                            <td className="px-2 py-1.5">
                              <div className="font-medium">{l.description}</div>
                              <div className="text-slate-500">
                                {[l.doc_no, l.lorry_number && `${t('gate.lorryNumber')}: ${l.lorry_number}`, l.from_date && `${formatDate(l.from_date, lang)} – ${formatDate(l.to_date, lang)}`, l.sac_code && `SAC ${l.sac_code}`].filter(Boolean).join(' · ')}
                              </div>
                              <div className="text-slate-400" data-testid="rate-source">{l.rate_source}</div>
                              {l.original_amount_paise !== null && <div className="text-amber-700">{t('billing.fixedFrom', { amount: formatINR(l.original_amount_paise) })}: {l.fix_reason}</div>}
                              {l.exempt && <div className="text-emerald-700">{t('billing.exempt')}: {l.exempt_reason}</div>}
                            </td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatNumber(l.quantity, lang, 3)} {l.unit}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatINR(l.rate_paise)}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatINR(l.discount_paise)}</td>
                            <td className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{formatINR(l.taxable_paise)}</td>
                            {admin && isDraft && <td className="px-2 py-1.5 whitespace-nowrap">
                              <Button size="sm" variant="ghost" aria-label={t('billing.fixLine')} icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setFix(l)} />
                              <Button size="sm" variant="ghost" aria-label={t('common.remove')} icon={<Ban className="h-3.5 w-3.5" />} onClick={() => setRemoving(l)} />
                            </td>}
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-right font-semibold">{t('billing.subtotal')} {sec === 'RENT' ? 'A' : sec === 'LABOUR' ? 'B' : 'C'}: {formatINR(subtotal)}</p>
              </section>
            )
          })}
          {detail.data.lines.length === 0 && <p className="text-slate-500">{t('billing.noLines')}</p>}

          <section>
            <h3 className="mb-1 font-semibold">{t('billing.taxSummary')}</h3>
            <table className="min-w-full text-xs"><thead className="text-left uppercase text-slate-500"><tr><th>{t('billing.section')}</th><th>SAC</th><th className="text-right">{t('billing.taxable')}</th><th className="text-right">{t('billing.rate')}</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th></tr></thead>
              <tbody>{detail.data.tax.map((x) => <tr key={x.id} className="border-t border-slate-100"><td>{t(`billing.section${x.section}`)}</td><td>{x.sac_code}</td><td className="text-right">{formatINR(x.taxable_paise)}</td><td className="text-right">{x.exempt ? t('billing.exempt') : bpToPercent(x.gst_rate_bp)}</td><td className="text-right">{formatINR(x.cgst_paise)}</td><td className="text-right">{formatINR(x.sgst_paise)}</td><td className="text-right">{formatINR(x.igst_paise)}</td></tr>)}</tbody></table>
          </section>
          <dl className="ml-auto w-full max-w-xs space-y-0.5">
            {totalRows.map(([k, v]) => <div key={k} className="flex justify-between"><dt>{k}</dt><dd>{formatINR(v)}</dd></div>)}
            <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-semibold" data-testid="grand-total"><dt>{t('billing.grandTotal')}</dt><dd>{formatINR(inv.grand_total_paise)}</dd></div>
          </dl>

          {detail.data.notes.length > 0 && <section><h3 className="mb-1 font-semibold">{t('billing.notes')}</h3>
            <ul className="space-y-1">{detail.data.notes.map((n) => <li key={n.id} className="flex justify-between rounded-lg bg-slate-50 px-2 py-1"><span>{n.note_no} · {t(`billing.${n.kind === 'CREDIT' ? 'credit' : 'debit'}`)} · {n.reason}</span><span>{formatINR(n.grand_total_paise)}</span></li>)}</ul></section>}
          {detail.data.allocations.length > 0 && <p className="text-slate-500">{t('billing.paymentsApplied', { count: detail.data.allocations.length })}</p>}
        </div>
      )}
      {fix && <FixLineDialog line={fix} onClose={() => setFix(null)} />}
      {adding && inv && <AddChargeDialog invoice={inv} onClose={() => setAdding(false)} />}
      {noting && inv && <NoteDialog invoice={inv} onClose={() => setNoting(false)} />}
      {paying && inv && <PaymentDialog invoice={inv} onClose={() => setPaying(false)} />}
      <ReasonDialog open={!!removing} title={t('billing.removeLine')} message={t('billing.removeLineHelp')} loading={remove.isPending} onConfirm={(r) => remove.mutate(r)} onClose={() => setRemoving(null)} />
      <ReasonDialog open={discarding} title={t('billing.discard')} message={t('billing.discardHelp')} loading={discard.isPending} onConfirm={(r) => discard.mutate(r)} onClose={() => setDiscarding(false)} />
      <ConfirmDialog open={issuing} title={t('billing.issue')} message={t('billing.issueHelp')} confirmLabel={t('billing.issue')} loading={issue.isPending} onConfirm={() => issue.mutate()} onClose={() => setIssuing(false)} />
      <Modal open={!!payLink} title={t('billing.paymentLink')} onClose={() => setPayLink(null)} footer={<>
        <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(payLink ?? ''); toast.success(t('billing.linkCopied')) }}>{t('billing.copyLink')}</Button>
        {emailFlag.data?.enabled && <Button icon={<Mail className="h-4 w-4" />} loading={busy} onClick={() => { const l = payLink!; setPayLink(null); void email(l) }}>{t('billing.emailWithLink')}</Button>}</>}>
        <p className="break-all rounded-lg bg-slate-50 p-3 font-mono text-xs">{payLink}</p>
      </Modal>
    </Modal>
  )
}
