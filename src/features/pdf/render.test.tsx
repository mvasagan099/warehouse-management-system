import { renderToBuffer } from '@react-pdf/renderer'
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// set PDF_OUT=/some/folder to keep the rendered files for a visual check
const keep = (name: string, buf: Buffer) => { if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/${name}.pdf`, buf) }
import { ChallanPdf, InvoicePdf, ReceiptPdf } from './documents'

const wh = { code: 'W1', name: 'Madurai Cold Store', city: 'Madurai', state: 'Tamil Nadu', contact_phone: '9000000000' }
const gate = { lorry_number: 'TN01AB1234', driver_name: 'Ravi', driver_phone: '9000000001', lorry_temp_c: -19, gate_pass_no: 'GP/W1/1', gate_in_at: '2026-11-20T04:00:00Z' }
const line = { id: 'l1', line_no: 1, item_name: 'Frozen peas', sku: null, batch_no: 'B1', expiry_date: '2027-05-01', unit: 'BOX', declared_qty: 100, accepted_qty: 95, short_qty: 5, damaged_qty: 0, weight_kg: 1200, packages: 100, quantity: 95, slot_code: 'W1-Z1-A1-R1-L1-B01', slot_codes: ['W1-Z1-A1-R1-L1-B01'], remarks: null }

describe('PDF documents render', () => {
  it('renders the inward receipt with a summary strip', async () => {
    const buf = await renderToBuffer(<ReceiptPdf receipt={{ receipt_no: 'GR/W1/2627/0001', received_at: '2026-11-20T05:00:00Z', status: 'CONFIRMED' } as never} lines={[line, { ...line, id: 'l2', line_no: 2 }] as never} warehouse={wh as never} client={{ company_name: 'Vikram' } as never} company={null} gate={gate as never} />)
    keep('receipt', buf); expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
  it('renders the challan', async () => {
    const buf = await renderToBuffer(<ChallanPdf challan={{ challan_no: 'DC/W1/2627/0001', dispatched_at: '2026-11-20T05:00:00Z', status: 'CONFIRMED', seal_number: null, dispatch_temp_c: -20 } as never} lines={[line] as never} warehouse={wh as never} client={{ company_name: 'Vikram' } as never} toCompany={{ name: 'Hotel Saravana' } as never} gate={gate as never} signatureDataUrl={null} />)
    keep('challan', buf); expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
  it('renders a part-paid invoice with the balance due', async () => {
    const inv = { invoice_no: 'INV/W1/2627/0001', status: 'PARTIALLY_PAID', invoice_date: '2026-11-20', due_date: '2026-12-05', period_from: '2026-11-01', period_to: '2026-11-20', place_of_supply: 'Tamil Nadu', supply_kind: 'INTRA',
      supplier_snapshot: { name: 'Cold Co', gstin: '33AABCT1332L1ZL', address: 'Madurai', upi_id: 'cold@upi', bank_name: 'HDFC' }, client_snapshot: { name: 'Vikram', address: 'Chennai', gstin: null },
      taxable_paise: 100000, cgst_paise: 9000, sgst_paise: 9000, igst_paise: 0, round_off_paise: 0, grand_total_paise: 118000, paid_paise: 50000, credit_paise: 0 }
    const l = { id: 'i1', section: 'RENT', description: 'Storage', sac_code: '996729', quantity: 10, unit: 'brigade-days', rate_paise: 10000, discount_paise: 0, taxable_paise: 100000, from_date: '2026-11-01', to_date: '2026-11-20', lorry_number: null, doc_no: null }
    const tax = [{ section: 'RENT', sac_code: '996729', taxable_paise: 100000, gst_rate_bp: 1800, cgst_paise: 9000, sgst_paise: 9000, igst_paise: 0, exempt: false }]
    const buf = await renderToBuffer(<InvoicePdf invoice={inv as never} lines={[l] as never} tax={tax as never} terms="Pay within 15 days" upiQr={null} />)
    keep('invoice', buf); expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
})
