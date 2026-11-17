import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Card, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { downloadText, paiseToRupeeText, toCsv } from './common'

const iso = (d: Date) => d.toISOString().slice(0, 10)
function monthStart() { const n = new Date(Date.now() + 5.5 * 3600_000); return iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1))) }

export function BillingReportsPage() {
  const { t } = useTranslation()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(iso(new Date(Date.now() + 5.5 * 3600_000)))
  const [group, setGroup] = useState<'month' | 'client' | 'warehouse'>('month')
  const [busy, setBusy] = useState('')
  const ok = !!from && !!to && to >= from

  const revenue = useQuery({ queryKey: ['report_revenue', from, to, group], enabled: ok,
    queryFn: async () => { const { data, error } = await supabase.rpc('report_revenue', { p_from: from, p_to: to, p_group: group }); if (error) throw error; return data } })
  const util = useQuery({ queryKey: ['report_utilisation', from, to], enabled: ok,
    queryFn: async () => { const { data, error } = await supabase.rpc('report_utilisation', { p_from: from, p_to: to }); if (error) throw error; return data } })

  const run = async (name: string, fn: () => Promise<void>) => { setBusy(name); try { await fn() } catch (e) { toast.error(await errorMessage(e)) } finally { setBusy('') } }
  const gstr1 = () => run('gstr1', async () => {
    const { data, error } = await supabase.rpc('gstr1_register', { p_from: from, p_to: to }); if (error) throw error
    downloadText(`gstr1-sales-register-${from}-${to}.csv`, toCsv(['Category', 'Document', 'Number', 'Date', 'Party', 'GSTIN', 'Place of supply', 'Section', 'SAC', 'GST rate %', 'Taxable', 'CGST', 'SGST', 'IGST', 'Exempt reason'],
      data.map((r) => [r.category, r.doc_type, r.doc_no, r.doc_date, r.party_name, r.gstin, r.place_of_supply, r.section, r.sac_code, r.gst_rate_bp / 100, paiseToRupeeText(r.taxable_paise), paiseToRupeeText(r.cgst_paise), paiseToRupeeText(r.sgst_paise), paiseToRupeeText(r.igst_paise), r.exempt_reason])))
  })
  const tally = () => run('tally', async () => {
    const { data, error } = await supabase.rpc('tally_export_xml', { p_from: from, p_to: to }); if (error) throw error
    downloadText(`tally-${from}-${to}.xml`, data, 'application/xml;charset=utf-8')
  })
  const ageingCsv = () => run('ageing', async () => {
    const { data, error } = await supabase.rpc('ageing_report'); if (error) throw error
    downloadText('outstanding-ageing.csv', toCsv(['Client', '0-30', '31-60', '61-90', '90+', 'Outstanding', 'Advance'], data.map((r) => [r.client_name, paiseToRupeeText(r.b0_30), paiseToRupeeText(r.b31_60), paiseToRupeeText(r.b61_90), paiseToRupeeText(r.b90_plus), paiseToRupeeText(r.outstanding_paise), paiseToRupeeText(r.advance_paise)])))
  })
  const revenueCsv = () => downloadText(`revenue-${group}-${from}-${to}.csv`, toCsv([group, 'Rent', 'Labour', 'Other', 'Tax', 'Total'], (revenue.data ?? []).map((r) => [r.bucket, paiseToRupeeText(r.rent_paise), paiseToRupeeText(r.labour_paise), paiseToRupeeText(r.other_paise), paiseToRupeeText(r.tax_paise), paiseToRupeeText(r.total_paise)])))
  const tot = (k: 'rent_paise' | 'labour_paise' | 'other_paise' | 'tax_paise' | 'total_paise') => (revenue.data ?? []).reduce((a, r) => a + r[k], 0)

  return (
    <div className="space-y-6">
      <PageHeader title={t('billing.reports')} />
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('billing.periodFrom')} htmlFor="rp-from"><Input id="rp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={t('billing.periodTo')} htmlFor="rp-to"><Input id="rp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={busy === 'gstr1'} disabled={!ok} onClick={gstr1}>{t('billing.gstr1')}</Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={busy === 'tally'} disabled={!ok} onClick={tally}>{t('billing.tally')}</Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={busy === 'ageing'} onClick={ageingCsv}>{t('billing.ageingCsv')}</Button>
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
          <h2 className="font-semibold">{t('billing.revenue')}</h2>
          <div className="flex gap-2">
            <Select aria-label={t('billing.groupBy')} value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className="w-44">
              <option value="month">{t('billing.byMonth')}</option><option value="client">{t('billing.byClient')}</option><option value="warehouse">{t('billing.byWarehouse')}</option>
            </Select>
            <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} disabled={!revenue.data?.length} onClick={revenueCsv}>CSV</Button>
          </div>
        </div>
        {revenue.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : (
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-sm" data-testid="revenue">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">{t(`billing.by${group === 'month' ? 'Month' : group === 'client' ? 'Client' : 'Warehouse'}`)}</th><th className="px-3 py-2 text-right">{t('billing.sectionRENT')}</th><th className="px-3 py-2 text-right">{t('billing.sectionLABOUR')}</th><th className="px-3 py-2 text-right">{t('billing.sectionOTHER')}</th><th className="px-3 py-2 text-right">{t('billing.tax')}</th><th className="px-3 py-2 text-right">{t('billing.grandTotal')}</th></tr></thead>
            <tbody>
              {(revenue.data ?? []).map((r) => <tr key={r.bucket}><td className="px-3 py-2">{r.bucket}</td>{[r.rent_paise, r.labour_paise, r.other_paise, r.tax_paise, r.total_paise].map((v, i) => <td key={i} className="px-3 py-2 text-right">{formatINR(v)}</td>)}</tr>)}
              {!revenue.data?.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">{t('billing.noRevenue')}</td></tr>}
              {!!revenue.data?.length && <tr className="border-t border-slate-300 font-semibold"><td className="px-3 py-2">{t('billing.total')}</td>{(['rent_paise', 'labour_paise', 'other_paise', 'tax_paise', 'total_paise'] as const).map((k) => <td key={k} className="px-3 py-2 text-right">{formatINR(tot(k))}</td>)}</tr>}
            </tbody></table></div>
        )}
      </Card>
      <Card>
        <div className="border-b border-slate-200 p-3"><h2 className="font-semibold">{t('billing.utilisation')}</h2><p className="text-xs text-slate-500">{t('billing.utilisationHelp')}</p></div>
        {util.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : (
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">{t('common.warehouse')}</th><th className="px-3 py-2 text-right">{t('billing.heldDays')}</th><th className="px-3 py-2 text-right">{t('billing.billedDays')}</th><th className="px-3 py-2 text-right">{t('billing.availableDays')}</th><th className="px-3 py-2 text-right">{t('billing.utilisationPct')}</th></tr></thead>
            <tbody>{(util.data ?? []).map((r) => <tr key={r.warehouse_id}><td className="px-3 py-2">{r.warehouse}</td><td className="px-3 py-2 text-right">{r.held_brigade_days}</td><td className="px-3 py-2 text-right">{r.billed_brigade_days}</td><td className="px-3 py-2 text-right">{r.available_brigade_days}</td><td className="px-3 py-2 text-right">{(r.utilisation_bp / 100).toFixed(2)}%</td></tr>)}</tbody></table></div>
        )}
      </Card>
    </div>
  )
}
