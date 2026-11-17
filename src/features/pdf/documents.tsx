import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type {
  Client, Company, DeliveryChallan, DeliveryChallanLine, GateEntry, InwardReceipt, InwardReceiptLine, Warehouse,
} from '../../lib/types'
import { APP_TIME_ZONE } from '../../lib/format'

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
