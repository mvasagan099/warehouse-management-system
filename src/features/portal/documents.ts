// Everything a client can download, as PDFs built in the browser from rows the database already limits to that client.
import { supabase } from '../../lib/supabase'
import { challanPdfBlob, invoicePdfBlob, receiptPdfBlob, registerPdfBlob, tempReportPdfBlob } from '../pdf/download'

export type DocKind = 'RECEIPT' | 'CHALLAN' | 'INVOICE' | 'CREDIT_NOTE' | 'TEMP_REPORT'
export interface DocRow { kind: DocKind; id: string; no: string; date: string; amountPaise?: number }

const fileSafe = (no: string) => no.replace(/[^A-Za-z0-9._-]+/g, '-')
export const docFileName = (d: DocRow) => `${d.kind.toLowerCase()}-${fileSafe(d.no)}.pdf`

/** The list for a period. From and to are India calendar dates (inclusive). */
export async function listDocuments(clientId: string, from: string, to: string): Promise<DocRow[]> {
  const fromTs = `${from}T00:00:00+05:30`; const toTs = `${to}T23:59:59.999+05:30`
  const [rc, ch, inv, notes] = await Promise.all([
    supabase.from('inward_receipts').select('id, receipt_no, received_at').eq('client_id', clientId).eq('status', 'CONFIRMED').gte('received_at', fromTs).lte('received_at', toTs).order('received_at', { ascending: false }).limit(500),
    supabase.from('delivery_challans').select('id, challan_no, dispatched_at').eq('client_id', clientId).eq('status', 'CONFIRMED').gte('dispatched_at', fromTs).lte('dispatched_at', toTs).order('dispatched_at', { ascending: false }).limit(500),
    supabase.from('invoices').select('id, invoice_no, invoice_date, grand_total_paise').eq('client_id', clientId).in('status', ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']).gte('invoice_date', from).lte('invoice_date', to).order('invoice_date', { ascending: false }).limit(500),
    supabase.from('adjustment_notes').select('id, note_no, note_date, kind, grand_total_paise').eq('client_id', clientId).gte('note_date', from).lte('note_date', to).order('note_date', { ascending: false }).limit(500),
  ])
  for (const r of [rc, ch, inv, notes]) if (r.error) throw r.error
  const rows: DocRow[] = [
    ...rc.data!.map((r) => ({ kind: 'RECEIPT' as const, id: r.id, no: r.receipt_no, date: r.received_at.slice(0, 10) })),
    ...ch.data!.map((r) => ({ kind: 'CHALLAN' as const, id: r.id, no: r.challan_no, date: r.dispatched_at.slice(0, 10) })),
    ...inv.data!.filter((r) => r.invoice_no).map((r) => ({ kind: 'INVOICE' as const, id: r.id, no: r.invoice_no!, date: r.invoice_date ?? '', amountPaise: r.grand_total_paise })),
    ...notes.data!.filter((r) => r.kind === 'CREDIT').map((r) => ({ kind: 'CREDIT_NOTE' as const, id: r.id, no: r.note_no, date: r.note_date, amountPaise: r.grand_total_paise })),
  ]
  rows.push({ kind: 'TEMP_REPORT', id: `${from}_${to}`, no: `${from} to ${to}`, date: to })
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export async function buildPdf(doc: DocRow, clientId: string, from: string, to: string, terms?: string): Promise<Blob> {
  if (doc.kind === 'RECEIPT') {
    const r = await supabase.from('inward_receipts').select('*').eq('id', doc.id).single(); if (r.error) throw r.error
    const [lines, gate, client, wh, company] = await Promise.all([
      supabase.from('inward_receipt_lines').select('*').eq('receipt_id', doc.id).order('line_no'), supabase.from('gate_entries').select('*').eq('id', r.data.gate_entry_id).single(),
      supabase.from('clients').select('*').eq('id', r.data.client_id).single(), supabase.from('warehouses').select('*').eq('id', r.data.warehouse_id).single(),
      r.data.company_id ? supabase.from('company_master').select('*').eq('id', r.data.company_id).maybeSingle() : Promise.resolve({ data: null, error: null })])
    if (lines.error) throw lines.error; if (gate.error) throw gate.error
    return receiptPdfBlob({ receipt: r.data, lines: lines.data, gate: gate.data, client: client.data, warehouse: wh.data, company: company.data } as never)
  }
  if (doc.kind === 'CHALLAN') {
    const c = await supabase.from('delivery_challans').select('*').eq('id', doc.id).single(); if (c.error) throw c.error
    const [lines, client, wh, company, gate] = await Promise.all([
      supabase.from('delivery_challan_lines').select('*').eq('challan_id', doc.id).order('line_no'), supabase.from('clients').select('*').eq('id', c.data.client_id).single(),
      supabase.from('warehouses').select('*').eq('id', c.data.warehouse_id).single(), supabase.from('company_master').select('*').eq('id', c.data.to_company_id).single(),
      supabase.from('gate_entries').select('*').eq('id', c.data.gate_entry_id).maybeSingle()])
    if (lines.error) throw lines.error
    return challanPdfBlob({ challan: c.data, lines: lines.data, client: client.data, warehouse: wh.data, toCompany: company.data, gate: gate.data } as never)
  }
  if (doc.kind === 'INVOICE') {
    const [inv, lines, tax] = await Promise.all([supabase.from('invoices').select('*').eq('id', doc.id).single(), supabase.from('invoice_lines').select('*').eq('invoice_id', doc.id).order('section').order('line_no'),
      supabase.from('invoice_tax_lines').select('*').eq('invoice_id', doc.id).order('section')])
    for (const r of [inv, lines, tax]) if (r.error) throw r.error
    return invoicePdfBlob({ invoice: inv.data!, lines: lines.data!, tax: tax.data!, terms, watermark: null } as never)
  }
  if (doc.kind === 'CREDIT_NOTE') {
    const [n, lines] = await Promise.all([supabase.from('adjustment_notes').select('*').eq('id', doc.id).single(), supabase.from('adjustment_note_lines').select('*').eq('note_id', doc.id)])
    if (n.error) throw n.error; if (lines.error) throw lines.error
    const inr = (p: number) => (p / 100).toFixed(2)
    return registerPdfBlob({ title: `Credit note ${n.data.note_no}`, subtitle: `${n.data.note_date} - ${n.data.reason}`, generatedAt: new Date().toISOString(),
      columns: [{ h: 'Description', w: '46%' }, { h: 'Taxable', w: '18%', right: true }, { h: 'GST %', w: '12%', right: true }, { h: 'Tax', w: '24%', right: true }],
      rows: [...lines.data.map((l) => [l.description, inr(l.taxable_paise), l.gst_rate_bp / 100, inr(l.cgst_paise + l.sgst_paise + l.igst_paise)]), ['Total', inr(n.data.taxable_paise), '', inr(n.data.grand_total_paise)]] })
  }
  const [p, l, client] = await Promise.all([supabase.rpc('client_temperature_report', { p_client_id: clientId, p_from: from, p_to: to }), supabase.rpc('client_lorry_temps', { p_client_id: clientId, p_from: from, p_to: to }), supabase.from('clients').select('*').eq('id', clientId).single()])
  if (p.error) throw p.error; if (l.error) throw l.error; if (client.error) throw client.error
  return tempReportPdfBlob({ client: client.data, from, to, generatedAt: new Date().toISOString(), periods: p.data, lorry: l.data })
}
