import { Document, Image, Page, Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import type {
  Client, Company, DeliveryChallan, DeliveryChallanLine, GateEntry, InwardReceipt, InwardReceiptLine, Warehouse,
} from '../../lib/types'
import { APP_TIME_ZONE } from '../../lib/format'
import type { Alert, AlertStock, ClientNotice, Invoice, InvoiceLine, InvoiceTaxLine, Sensor, Zone } from '../../lib/types'
import { sparkPath } from '../coldchain/common'
import { amountInWords, bpToPercent, formatIndian } from '../../lib/words'

// Documents are printed in English with the built-in Helvetica font (Tamil needs an embedded font; see README).
const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#0f172a' },
  head: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1pt solid #0e7490', paddingBottom: 8, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#0e7490' },
  small: { fontSize: 8, color: '#475569' },
  bold: { fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  box: { flex: 1, border: '0.5pt solid #cbd5e1', borderRadius: 3, padding: 6 },
  label: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', marginBottom: 1 },
  th: { backgroundColor: '#f1f5f9', fontWeight: 'bold', fontSize: 8 },
  tr: { flexDirection: 'row', borderBottom: '0.5pt solid #e2e8f0' },
  td: { padding: 3 },
  sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 34 },
  sig: { width: '30%', borderTop: '0.5pt solid #0f172a', paddingTop: 3, textAlign: 'center', fontSize: 8 },
  note: { marginTop: 6, padding: 5, backgroundColor: '#fef3c7', fontSize: 8 },
  foot: { position: 'absolute', bottom: 16, left: 28, right: 28, textAlign: 'center', fontSize: 7, color: '#94a3b8' },
})

const dt = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat('en-IN', { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(v)) : '-'
const d = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat('en-IN', { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '-'
const n = (v: number | null | undefined, max = 3) => (v === null || v === undefined ? '-' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: max }).format(v))

function Party({ title, name, lines }: { title: string; name?: string | null; lines: (string | null | undefined)[] }) {
  return (
    <View style={s.box}>
      <Text style={s.label}>{title}</Text>
      <Text style={s.bold}>{name ?? '-'}</Text>
      {lines.filter(Boolean).map((l, i) => <Text key={i}>{l}</Text>)}
    </View>
  )
}
const addr = (p: { address_line1?: string | null; address_line2?: string | null; city?: string | null; district?: string | null; state?: string | null; pincode?: string | null }) =>
  [p.address_line1, p.address_line2, [p.city, p.district].filter(Boolean).join(', '), [p.state, p.pincode].filter(Boolean).join(' - ')].filter(Boolean).join(', ')

function Table({ cols, rows }: { cols: { h: string; w: string; right?: boolean }[]; rows: (string | number)[][] }) {
  return (
    <View style={{ marginTop: 4 }}>
      <View style={[s.tr, s.th]}>{cols.map((c) => <Text key={c.h} style={[s.td, { width: c.w, textAlign: c.right ? 'right' : 'left' }]}>{c.h}</Text>)}</View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          {r.map((cell, j) => <Text key={j} style={[s.td, { width: cols[j].w, textAlign: cols[j].right ? 'right' : 'left' }]}>{cell}</Text>)}
        </View>
      ))}
    </View>
  )
}

export interface ReceiptPdfData {
  receipt: InwardReceipt
  lines: InwardReceiptLine[]
  warehouse: Warehouse | null
  client: Client | null
  company: Company | null
  gate: GateEntry
}

export function ReceiptPdf({ receipt, lines, warehouse, client, company, gate }: ReceiptPdfData) {
  const issues = lines.filter((l) => l.short_qty > 0 || l.damaged_qty > 0)
  return (
    <Document title={receipt.receipt_no} author={warehouse?.name ?? 'Cold Storage WMS'}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>INWARD RECEIPT (GRN)</Text>
            <Text style={s.small}>{warehouse?.name} · {addr(warehouse ?? {})}</Text>
            {warehouse?.contact_phone && <Text style={s.small}>Phone: {warehouse.contact_phone}</Text>}
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={[s.bold, { fontSize: 12 }]}>{receipt.receipt_no}</Text>
            <Text style={s.small}>Received: {dt(receipt.received_at)}</Text>
            {receipt.status === 'CANCELLED' && <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>CANCELLED</Text>}
          </View>
        </View>

        <View style={s.row}>
          <Party title="Client" name={client?.company_name} lines={[client?.gstin ? `GSTIN: ${client.gstin}` : null, client ? addr(client) : null]} />
          <Party title="From company (sender)" name={company?.name} lines={[company?.gstin ? `GSTIN: ${company.gstin}` : null, company ? addr(company) : null]} />
        </View>

        <View style={s.row}>
          <View style={s.box}>
            <Text style={s.label}>Lorry and driver</Text>
            <Text>Lorry: <Text style={s.bold}>{gate.lorry_number}</Text> {gate.lorry_type ? `(${gate.lorry_type})` : ''}</Text>
            <Text>Driver: {gate.driver_name ?? '-'} {gate.driver_phone ?? ''}</Text>
            <Text>Licence: {gate.driver_licence_no ?? '-'}</Text>
            <Text>Transporter: {gate.transporter_name ?? '-'}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.label}>Documents and seal</Text>
            <Text>E-way bill: {gate.eway_bill_number ?? '-'} (valid until {dt(gate.eway_valid_until)})</Text>
            <Text>LR no: {gate.lr_number ?? '-'}   Invoice: {gate.invoice_number ?? '-'}</Text>
            <Text>Seal on arrival: {gate.seal_number_arrival ?? '-'}</Text>
            <Text>Arrival temperature: {gate.lorry_temp_c !== null ? `${gate.lorry_temp_c} C` : '-'}</Text>
            <Text>Gate pass: {gate.gate_pass_no} · Gate in: {dt(gate.gate_in_at)}</Text>
          </View>
        </View>

        <Table
          cols={[
            { h: '#', w: '4%' }, { h: 'Item / SKU / Batch', w: '26%' }, { h: 'Expiry', w: '10%' }, { h: 'Declared', w: '9%', right: true },
            { h: 'Accepted', w: '9%', right: true }, { h: 'Short', w: '7%', right: true }, { h: 'Damaged', w: '8%', right: true },
            { h: 'Weight kg', w: '9%', right: true }, { h: 'Slots', w: '18%' },
          ]}
          rows={lines.map((l) => [
            l.line_no, `${l.item_name}${l.sku ? ` / ${l.sku}` : ''}${l.batch_no ? ` / ${l.batch_no}` : ''}`, d(l.expiry_date),
            `${n(l.declared_qty)} ${l.unit}`, n(l.accepted_qty), n(l.short_qty), n(l.damaged_qty), n(l.weight_kg), l.slot_codes.join(', '),
          ])}
        />

        {issues.length > 0 && (
          <View style={s.note}>
            <Text style={s.bold}>Shortage and damage remarks</Text>
            {issues.map((l) => (
              <Text key={l.id}>
                Line {l.line_no} {l.item_name}: {l.short_qty > 0 ? `short ${n(l.short_qty)} ${l.unit}. ` : ''}{l.damaged_qty > 0 ? `damaged ${n(l.damaged_qty)} ${l.unit}. ` : ''}{l.remarks ?? ''}
              </Text>
            ))}
          </View>
        )}
        {receipt.remarks && <Text style={{ marginTop: 6 }}>Remarks: {receipt.remarks}</Text>}
        {receipt.status === 'CANCELLED' && <Text style={{ marginTop: 6, color: '#dc2626' }}>Cancelled: {receipt.cancel_reason}</Text>}

        <View style={s.sigRow}>
          <Text style={s.sig}>Received by (warehouse)</Text>
          <Text style={s.sig}>Driver</Text>
          <Text style={s.sig}>Client representative</Text>
        </View>
        <Text style={s.foot} fixed>Computer generated receipt · {receipt.receipt_no}</Text>
      </Page>
    </Document>
  )
}

export interface ChallanPdfData {
  challan: DeliveryChallan
  lines: DeliveryChallanLine[]
  warehouse: Warehouse | null
  client: Client | null
  toCompany: Company | null
  gate: GateEntry | null
  signatureDataUrl: string | null
}

export function ChallanPdf({ challan, lines, warehouse, client, toCompany, gate, signatureDataUrl }: ChallanPdfData) {
  return (
    <Document title={challan.challan_no} author={warehouse?.name ?? 'Cold Storage WMS'}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>DELIVERY CHALLAN</Text>
            <Text style={s.small}>{warehouse?.name} · {addr(warehouse ?? {})}</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={[s.bold, { fontSize: 12 }]}>{challan.challan_no}</Text>
            <Text style={s.small}>Dispatched: {dt(challan.dispatched_at)}</Text>
            {challan.status === 'CANCELLED' && <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>CANCELLED</Text>}
          </View>
        </View>

        <View style={s.row}>
          <Party title="From (warehouse and client)" name={client?.company_name} lines={[`Stored at: ${warehouse?.name ?? '-'}`, client?.gstin ? `GSTIN: ${client.gstin}` : null, client ? addr(client) : null]} />
          <Party title="To (receiver company)" name={toCompany?.name} lines={[toCompany?.gstin ? `GSTIN: ${toCompany.gstin}` : null, toCompany ? addr(toCompany) : null]} />
        </View>

        <View style={s.row}>
          <View style={s.box}>
            <Text style={s.label}>Lorry and driver</Text>
            <Text>Lorry: <Text style={s.bold}>{gate?.lorry_number ?? '-'}</Text> {gate?.lorry_type ? `(${gate.lorry_type})` : ''}</Text>
            <Text>Driver: {gate?.driver_name ?? '-'} {gate?.driver_phone ?? ''}</Text>
            <Text>Licence: {gate?.driver_licence_no ?? '-'}</Text>
          </View>
          <View style={s.box}>
            <Text style={s.label}>Dispatch details</Text>
            <Text>E-way bill: {gate?.eway_bill_number ?? '-'} (valid until {dt(gate?.eway_valid_until)})</Text>
            <Text>Seal number: {challan.seal_number ?? '-'}</Text>
            <Text>Dispatch temperature: {challan.dispatch_temp_c !== null ? `${challan.dispatch_temp_c} C` : '-'}</Text>
            <Text>Gate pass: {gate?.gate_pass_no ?? '-'}</Text>
          </View>
        </View>

        <Table
          cols={[
            { h: '#', w: '4%' }, { h: 'Item / SKU', w: '28%' }, { h: 'Batch', w: '14%' }, { h: 'Expiry', w: '12%' },
            { h: 'Quantity', w: '12%', right: true }, { h: 'Packages', w: '9%', right: true }, { h: 'Weight kg', w: '10%', right: true }, { h: 'Slot', w: '11%' },
          ]}
          rows={lines.map((l) => [l.line_no, `${l.item_name}${l.sku ? ` / ${l.sku}` : ''}`, l.batch_no ?? '-', d(l.expiry_date), `${n(l.quantity)} ${l.unit}`, n(l.packages, 0), n(l.weight_kg), l.slot_code])}
        />
        {challan.remarks && <Text style={{ marginTop: 6 }}>Remarks: {challan.remarks}</Text>}
        {challan.status === 'CANCELLED' && <Text style={{ marginTop: 6, color: '#dc2626' }}>Cancelled: {challan.cancel_reason}</Text>}

        <View style={s.sigRow}>
          <Text style={s.sig}>Issued by (warehouse)</Text>
          <Text style={s.sig}>Driver</Text>
          <View style={{ width: '34%', alignItems: 'center' }}>
            {signatureDataUrl ? <Image src={signatureDataUrl} style={{ height: 40, objectFit: 'contain' }} /> : <View style={{ height: 40 }} />}
            <Text style={[s.sig, { width: '100%' }]}>Receiver: {challan.receiver_name ?? ''} {challan.pod_signed_at ? `(${dt(challan.pod_signed_at)})` : ''}</Text>
          </View>
        </View>
        <Text style={s.foot} fixed>Computer generated challan · {challan.challan_no}</Text>
      </Page>
    </Document>
  )
}


// ------------------------------------------------------------------ Tax invoice (Phase 3) ------------------------------------------------------------------
export interface InvoicePdfData {
  invoice: Invoice
  lines: InvoiceLine[]
  tax: InvoiceTaxLine[]
  terms?: string | null
  /** shown on the draft preview only */
  watermark?: string | null
}

type Snap = Record<string, string | boolean | null | undefined>
const SECTION_TITLE = { RENT: 'A. Rent (storage)', LABOUR: 'B. Labour (handling)', OTHER: 'C. Other charges' } as const
const SUPPLY_LABEL = { INTRA: 'Intra-state supply: CGST + SGST', INTER: 'Inter-state supply: IGST', CONSUMER: 'Unregistered recipient: CGST + SGST' } as const
const money = (p: number) => formatIndian(p)

export function InvoicePdf({ invoice: inv, lines, tax, terms, watermark }: InvoicePdfData) {
  const sup = (inv.supplier_snapshot ?? {}) as Snap
  const cli = (inv.client_snapshot ?? {}) as Snap
  const sections = (['RENT', 'LABOUR', 'OTHER'] as const).filter((sec) => lines.some((l) => l.section === sec))
  const hasLorry = lines.some((l) => l.lorry_number)
  const taxBy = (sec: string) => tax.filter((t) => t.section === sec)
  const exempt = tax.filter((t) => t.exempt)
  return (
    <Document title={inv.invoice_no ?? 'Draft invoice'}>
      <Page size="A4" style={s.page}>
        {watermark && <Text style={{ position: 'absolute', top: 300, left: 90, fontSize: 70, color: '#e2e8f0', transform: 'rotate(-30deg)' }}>{watermark}</Text>}
        <View style={s.head}>
          <View>
            <Text style={s.title}>TAX INVOICE</Text>
            <Text style={s.bold}>{String(sup.legal_name || sup.name || '')}</Text>
            <Text>{String(sup.address ?? '')}</Text>
            <Text>GSTIN: {String(sup.gstin || '-')}   PAN: {String(sup.pan || '-')}</Text>
            <Text>State: {String(sup.state_name ?? '')} ({String(sup.state_code ?? '')})</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={s.bold}>Invoice no: {inv.invoice_no ?? 'DRAFT'}</Text>
            <Text>Date: {d(inv.invoice_date)}</Text>
            <Text>Due date: {d(inv.due_date)}</Text>
            <Text>Period: {d(inv.period_from)} to {d(inv.period_to)}</Text>
            <Text>{inv.irn ? `IRN: ${inv.irn}` : ''}</Text>
          </View>
        </View>
        <View style={s.row}>
          <Party title="Bill to" name={String(cli.name ?? '')} lines={[String(cli.address ?? ''), `GSTIN: ${cli.gstin ? String(cli.gstin) : 'Unregistered'}`, cli.pan ? `PAN: ${String(cli.pan)}` : null]} />
          <Party title="Place of supply" name={`${String(inv.place_of_supply ?? '')}`} lines={[SUPPLY_LABEL[inv.supply_kind as keyof typeof SUPPLY_LABEL] ?? '']} />
        </View>

        {sections.map((sec) => {
          const rows = lines.filter((l) => l.section === sec)
          const taxable = rows.reduce((a, l) => a + l.taxable_paise, 0)
          const cols = sec === 'LABOUR'
            ? [{ h: 'Document', w: '17%' }, ...(hasLorry ? [{ h: 'Lorry', w: '12%' }] : []), { h: 'Description', w: hasLorry ? '27%' : '39%' }, { h: 'Qty', w: '9%', right: true }, { h: 'Rate', w: '11%', right: true }, { h: 'Discount', w: '10%', right: true }, { h: 'Taxable', w: '14%', right: true }]
            : [{ h: 'Description', w: '44%' }, { h: 'SAC', w: '9%' }, { h: 'Qty', w: '10%', right: true }, { h: 'Rate', w: '12%', right: true }, { h: 'Discount', w: '10%', right: true }, { h: 'Taxable', w: '15%', right: true }]
          const body = rows.map((l) => sec === 'LABOUR'
            ? [l.doc_no ?? '-', ...(hasLorry ? [l.lorry_number ?? '-'] : []), l.description, `${n(l.quantity, 3)} ${l.unit}`, money(l.rate_paise), money(l.discount_paise), money(l.taxable_paise)]
            : [`${l.description}${l.from_date ? ` (${d(l.from_date)} to ${d(l.to_date)})` : ''}`, l.sac_code ?? '-', `${n(l.quantity, 3)} ${l.unit}`, money(l.rate_paise), money(l.discount_paise), money(l.taxable_paise)])
          return (
            <View key={sec} style={{ marginBottom: 8 }} wrap>
              <Text style={[s.bold, { marginTop: 4 }]}>{SECTION_TITLE[sec]}</Text>
              <Table cols={cols} rows={body} />
              <Text style={{ textAlign: 'right', marginTop: 2 }} wrap={false}><Text style={s.bold}>Subtotal {SECTION_TITLE[sec].slice(0, 1)}: </Text>{money(taxable)}</Text>
            </View>
          )
        })}

        <Text style={[s.bold, { marginTop: 4 }]}>Tax summary</Text>
        <Table
          cols={[{ h: 'Section', w: '22%' }, { h: 'SAC', w: '12%' }, { h: 'Taxable', w: '18%', right: true }, { h: 'Rate', w: '8%', right: true }, { h: 'CGST', w: '13%', right: true }, { h: 'SGST', w: '13%', right: true }, { h: 'IGST', w: '14%', right: true }]}
          rows={(['RENT', 'LABOUR', 'OTHER'] as const).flatMap((sec) => taxBy(sec).map((t) => [SECTION_TITLE[sec].slice(3), t.sac_code ?? '-', money(t.taxable_paise), bpToPercent(t.gst_rate_bp), money(t.cgst_paise), money(t.sgst_paise), money(t.igst_paise)]))}
        />
        {exempt.length > 0 && <Text style={s.note}>Exempt supply: {exempt.map((t) => t.exempt_reason).filter(Boolean).join('; ') || 'exempt'}</Text>}

        <View style={{ alignSelf: 'flex-end', width: '50%', marginTop: 8 }} wrap={false}>
          {([['Taxable value', inv.taxable_paise], ['CGST', inv.cgst_paise], ['SGST', inv.sgst_paise], ['IGST', inv.igst_paise], ['Round off', inv.round_off_paise]] as [string, number][]).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>{k}</Text><Text>{money(v)}</Text></View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTop: '1pt solid #0f172a', marginTop: 2, paddingTop: 2 }}>
            <Text style={s.bold}>Grand total (INR)</Text><Text style={s.bold}>{money(inv.grand_total_paise)}</Text>
          </View>
        </View>
        <Text style={{ marginTop: 6 }}><Text style={s.bold}>Amount in words: </Text>{amountInWords(inv.grand_total_paise)}</Text>

        <View style={[s.row, { marginTop: 10 }]} wrap={false}>
          <View style={s.box}>
            <Text style={s.label}>Bank details</Text>
            <Text>{String(sup.bank_name ?? '')} {String(sup.bank_branch ?? '')}</Text>
            <Text>A/c: {String(sup.bank_account ?? '-')}   IFSC: {String(sup.bank_ifsc ?? '-')}</Text>
            {sup.upi_id ? <Text>UPI: {String(sup.upi_id)}</Text> : null}
          </View>
          <View style={s.box}>
            <Text style={s.label}>Terms</Text>
            <Text>{terms ?? ''}</Text>
          </View>
        </View>
        <View style={s.sigRow} wrap={false}>
          <Text style={s.sig}>Receiver's signature</Text>
          <Text style={s.sig}>For {String(sup.legal_name || sup.name || 'the supplier')}{'\n'}Authorised signatory</Text>
        </View>
        <Text style={s.foot} fixed render={({ pageNumber, totalPages }) => `${inv.invoice_no ?? 'DRAFT'} · page ${pageNumber} of ${totalPages} · computer generated invoice`} />
      </Page>
    </Document>
  )
}


// ------------------------------------------------------------------ Cold chain (Phase 4) ------------------------------------------------------------------
const fnum = (v: number | null | undefined, max = 1) => (v === null || v === undefined ? '-' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: max }).format(v))
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`)

/** Readings chart drawn as SVG: the allowed range as a shaded band, the line broken wherever data is missing. */
function ReadingsChart({ rows, lo, hi, width = 520, height = 150 }: { rows: { t: number; v: number }[]; lo: number | null; hi: number | null; width?: number; height?: number }) {
  if (rows.length < 2) return <Text style={s.small}>Not enough readings to draw a chart.</Text>
  const vs = rows.map((r) => r.v)
  const min = Math.min(...vs, lo ?? Infinity), max = Math.max(...vs, hi ?? -Infinity)
  const y = (v: number) => (max === min ? height / 2 : height - ((v - min) / (max - min)) * height)
  return (
    <View>
      <Svg width={width} height={height + 4} viewBox={`0 0 ${width} ${height + 4}`}>
        <Rect x={0} y={0} width={width} height={height} fill="#f8fafc" />
        {lo !== null && hi !== null && <Rect x={0} y={y(hi)} width={width} height={Math.max(y(lo) - y(hi), 1)} fill="#d1fae5" />}
        <Path d={sparkPath(rows, width, height, 15 * 60_000, lo ?? undefined, hi ?? undefined)} stroke="#0e7490" strokeWidth={1.2} fill="none" />
      </Svg>
      <Text style={s.small}>Range {fnum(min)} to {fnum(max)} C{lo !== null && hi !== null ? `; allowed ${fnum(lo)} to ${fnum(hi)} C (green band)` : ''}. A gap in the line means no data was received.</Text>
    </View>
  )
}

export interface ClientTempReportPdfData {
  client: Client
  from: string; to: string; generatedAt: string
  periods: { zone_code: string; zone_name: string; temp_min: number | null; temp_max: number | null; slots: string[]; brigades: number; from_date: string; to_date: string; min_c: number | null; max_c: number | null; avg_c: number | null; readings: number; minutes_out: number; minutes_covered: number; minutes_period: number; approx: boolean }[]
  lorry: { doc_type: string; doc_no: string; at: string; lorry_number: string | null; temp_c: number | null }[]
}
export function ClientTempReportPdf({ client, from, to, generatedAt, periods, lorry }: ClientTempReportPdfData) {
  return (
    <Document title={`Temperature report ${client.company_name}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head}><View><Text style={s.title}>TEMPERATURE COMPLIANCE REPORT</Text><Text style={s.bold}>{client.company_name}</Text><Text>{client.gstin ? `GSTIN ${client.gstin}` : ''}</Text></View>
          <View style={{ textAlign: 'right' }}><Text>Period: {d(from)} to {d(to)}</Text><Text>Generated: {dt(generatedAt)}</Text></View></View>
        <Text style={s.small}>Only the places and days your stock was stored are included. Out of range is measured against the zone limits with no tolerance; minutes are the time between readings (gaps over 15 minutes are not counted as covered).</Text>
        <Text style={[s.bold, { marginTop: 8 }]}>Storage zones and temperatures</Text>
        <Table cols={[{ h: 'Zone', w: '17%' }, { h: 'Allowed', w: '11%' }, { h: 'Your stock there', w: '19%' }, { h: 'Min', w: '7%', right: true }, { h: 'Max', w: '7%', right: true }, { h: 'Avg', w: '7%', right: true }, { h: 'Out of range', w: '12%', right: true }, { h: 'Coverage', w: '12%', right: true }, { h: 'Readings', w: '8%', right: true }]}
          rows={periods.map((p) => [`${p.zone_code} ${p.zone_name}`, p.temp_min !== null && p.temp_max !== null ? `${fnum(p.temp_min, 0)} to ${fnum(p.temp_max, 0)} C` : '-', `${d(p.from_date)} to ${d(p.to_date)}\n${p.brigades} Brigade(s): ${p.slots.join(', ')}`,
            fnum(p.min_c), fnum(p.max_c), fnum(p.avg_c), mins(p.minutes_out), `${p.minutes_period > 0 ? Math.round((p.minutes_covered / p.minutes_period) * 100) : 0}%`, `${p.readings}${p.approx ? '*' : ''}`])} />
        {periods.some((p) => p.approx) && <Text style={s.small}>* includes hourly summaries of older data: out-of-range time for those hours is counted per hour.</Text>}
        {periods.length === 0 && <Text style={s.note}>No stock of this client was stored in any zone during this period.</Text>}
        <Text style={[s.bold, { marginTop: 10 }]}>Lorry temperatures at arrival and dispatch</Text>
        <Table cols={[{ h: 'Document', w: '26%' }, { h: 'Type', w: '20%' }, { h: 'Date and time', w: '26%' }, { h: 'Lorry', w: '16%' }, { h: 'Temp C', w: '12%', right: true }]}
          rows={lorry.map((l) => [l.doc_no, l.doc_type === 'INWARD_RECEIPT' ? 'Arrival' : 'Dispatch', dt(l.at), l.lorry_number ?? '-', fnum(l.temp_c)])} />
        <Text style={s.foot} fixed render={({ pageNumber, totalPages }) => `${client.company_name} · temperature report · page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  )
}

export interface EvidencePackPdfData {
  alert: Alert; zone: Zone | null; warehouse: Warehouse | null; sensor: Sensor | null
  evidence: { recorded_at: string; value: number; raw_value: number; source: string }[]
  stock: AlertStock[]; notices: ClientNotice[]; clientNames: Record<string, string>; photos?: string[]; generatedAt?: string
}
export function EvidencePackPdf({ alert: a, zone, warehouse, sensor, evidence, stock, notices, clientNames, photos = [], generatedAt }: EvidencePackPdfData) {
  const rows = evidence.map((e) => ({ t: Date.parse(e.recorded_at), v: e.value }))
  const timeline: [string | null, string][] = [[a.event_start, 'Event start (first reading out of range)'], [a.opened_at, 'Alert opened'], [a.escalation_level > 0 ? a.escalated_at : null, `Escalated (level ${a.escalation_level})`],
    [a.acknowledged_at, 'Acknowledged'], [a.recovered_at, 'Readings back in range'], [a.resolved_at, 'Resolved']]
  const shown = evidence.length > 360 ? evidence.filter((_, i) => i % Math.ceil(evidence.length / 360) === 0) : evidence
  return (
    <Document title={`Evidence pack ${a.id.slice(0, 8)}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head}><View><Text style={s.title}>TEMPERATURE EXCURSION: EVIDENCE PACK</Text><Text style={s.bold}>{warehouse?.name ?? ''} · zone {zone?.code ?? ''} {zone?.name ?? ''}</Text></View>
          <View style={{ textAlign: 'right' }}><Text>Alert {a.id.slice(0, 8)}</Text><Text>Generated {dt(generatedAt ?? new Date().toISOString())}</Text></View></View>
        <View style={s.row}>
          <Party title="Event" name={`${a.kind.replace('_', ' ')} · ${a.severity}`} lines={[`Started ${dt(a.event_start)}`, a.recovered_at ? `Recovered ${dt(a.recovered_at)}` : 'Still in progress', `Duration ${mins(a.duration_min)}`]} />
          <Party title="Measurements" name={`Peak ${fnum(a.peak_value)} C`} lines={[`Deviation beyond limit ${fnum(a.peak_deviation)} C`, `Limit ${fnum(a.limit_value)} C; allowed ${zone ? `${fnum(zone.temp_min, 0)} to ${fnum(zone.temp_max, 0)} C` : '-'}`, `Sensor ${sensor?.name ?? '-'} (${sensor?.serial_no ?? '-'})`]} />
        </View>
        <Text style={s.bold}>Readings chart</Text>
        <ReadingsChart rows={rows} lo={zone?.temp_min ?? null} hi={zone?.temp_max ?? null} />
        <Text style={[s.bold, { marginTop: 8 }]}>Timeline</Text>
        {timeline.filter(([ts]) => ts).map(([ts, label]) => <Text key={label}>{dt(ts)}  -  {label}</Text>)}
        {a.status === 'RESOLVED' && <View style={s.note}><Text style={s.bold}>Cause</Text><Text>{a.cause}</Text><Text style={s.bold}>Action taken</Text><Text>{a.action_taken}</Text><Text>Resolved {dt(a.resolved_at)}</Text></View>}
        <Text style={[s.bold, { marginTop: 8 }]}>Affected stock (clients, batches, Brigades)</Text>
        <Table cols={[{ h: 'Client', w: '28%' }, { h: 'Slot', w: '12%' }, { h: 'Item', w: '24%' }, { h: 'Batch', w: '18%' }, { h: 'Qty', w: '18%', right: true }]}
          rows={stock.map((x) => [x.client_name, x.slot_code ?? '-', x.item_name ?? '-', x.batch_no ?? '-', x.quantity !== null ? `${fnum(x.quantity, 3)} ${x.unit ?? ''}` : '-'])} />
        {notices.length > 0 && <><Text style={[s.bold, { marginTop: 8 }]}>Client notices</Text>
          {notices.map((n) => <Text key={n.id}>{clientNames[n.client_id] ?? n.client_id}: {n.status}{n.approved_at ? ` (${dt(n.approved_at)})` : ''}</Text>)}</>}
        <Text style={s.foot} fixed render={({ pageNumber, totalPages }) => `Evidence pack ${a.id.slice(0, 8)} · page ${pageNumber} of ${totalPages}`} />
      </Page>
      <Page size="A4" style={s.page}>
        <Text style={s.bold}>Evidence readings ({evidence.length} raw readings from 30 minutes before the event{evidence.length > shown.length ? `; every ${Math.ceil(evidence.length / 360)}th shown` : ''})</Text>
        <Table cols={[{ h: 'Time (IST)', w: '40%' }, { h: 'Value C', w: '20%', right: true }, { h: 'Raw C', w: '20%', right: true }, { h: 'Source', w: '20%' }]}
          rows={shown.map((e) => [dt(e.recorded_at), fnum(e.value, 2), fnum(e.raw_value, 2), e.source])} />
        {photos.length > 0 && <><Text style={[s.bold, { marginTop: 8 }]}>Photos</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{photos.map((p, i) => <Image key={i} src={p} style={{ width: 160, height: 120 }} />)}</View></>}
        <Text style={s.foot} fixed render={({ pageNumber, totalPages }) => `Evidence pack ${a.id.slice(0, 8)} · page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  )
}

export interface RegisterPdfData { title: string; subtitle?: string; columns: { h: string; w: string; right?: boolean }[]; rows: (string | number)[][]; signature?: boolean; generatedAt?: string }
/** One generic register: the daily log sheet (with a signature line), the calibration register and the alert register. */
export function RegisterPdf({ title, subtitle, columns, rows, signature, generatedAt }: RegisterPdfData) {
  return (
    <Document title={title}>
      <Page size="A4" style={s.page} orientation="landscape">
        <View style={s.head}><View><Text style={s.title}>{title}</Text>{subtitle && <Text style={s.bold}>{subtitle}</Text>}</View><View style={{ textAlign: 'right' }}><Text>Generated {dt(generatedAt ?? new Date().toISOString())}</Text></View></View>
        <Table cols={columns} rows={rows} />
        {rows.length === 0 && <Text style={s.note}>No entries.</Text>}
        {signature && <View style={s.sigRow} wrap={false}><Text style={s.sig}>Checked by (name and signature)</Text><Text style={s.sig}>Supervisor</Text><Text style={s.sig}>Date</Text></View>}
        <Text style={s.foot} fixed render={({ pageNumber, totalPages }) => `${title} · page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  )
}
