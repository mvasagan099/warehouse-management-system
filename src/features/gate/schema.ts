import { z } from 'zod'
import { optionalNumber, optionalPhone, optionalText, positiveNumber, requiredText } from '../../lib/zod'
import { Constants, type GateDirection, type GateEntryLine } from '../../lib/types'

/** Lorry numbers are stored upper-case without spaces or dashes: TN 01 AB-1234 -> TN01AB1234. */
export const normaliseLorry = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')

export const gateEntrySchema = z.object({
  direction: z.enum(Constants.public.Enums.gate_direction),
  warehouse_id: z.string().min(1, 'validation.required'),
  client_id: z.string().min(1, 'validation.required'),
  company_id: z.string().transform((v) => (v === '' ? null : v)),
  lorry_number: z.string().transform(normaliseLorry).refine((v) => /^[A-Z0-9]{4,12}$/.test(v), 'validation.lorry'),
  lorry_type: optionalText(60),
  capacity_tonnes: optionalNumber.refine((v) => v === null || v > 0, 'validation.positive'),
  driver_name: optionalText(100),
  driver_phone: optionalPhone,
  driver_licence_no: optionalText(40),
  transporter_name: optionalText(120),
  lr_number: optionalText(40),
  invoice_number: optionalText(60),
  eway_bill_number: z.string().transform((v) => v.replace(/\s/g, '')).refine((v) => v === '' || /^\d{12}$/.test(v), 'validation.eway').transform((v) => (v === '' ? null : v)),
  eway_valid_until: z.string().transform((v) => (v === '' ? null : new Date(v).toISOString())),
  seal_number_arrival: optionalText(40),
  lorry_temp_c: optionalNumber,
  remarks: optionalText(500),
})
export type GateFormInput = z.input<typeof gateEntrySchema>
export type GateFormOutput = z.output<typeof gateEntrySchema>

export const emptyGate = (direction: GateDirection, warehouseId = '', clientId = ''): GateFormInput => ({
  direction, warehouse_id: warehouseId, client_id: clientId, company_id: '', lorry_number: '', lorry_type: '', capacity_tonnes: '', driver_name: '',
  driver_phone: '', driver_licence_no: '', transporter_name: '', lr_number: '', invoice_number: '', eway_bill_number: '',
  eway_valid_until: '', seal_number_arrival: '', lorry_temp_c: '', remarks: '',
})

// ---------- load line ----------
export const gateLineSchema = z
  .object({
    item_name: requiredText(150),
    sku: optionalText(60),
    batch_no: optionalText(60),
    mfg_date: z.string().transform((v) => (v === '' ? null : v)),
    expiry_date: z.string().transform((v) => (v === '' ? null : v)),
    packages: z.string().trim().refine((v) => v === '' || /^\d+$/.test(v), 'validation.positiveInt').transform((v) => (v === '' ? 0 : Number(v))),
    unit: requiredText(20),
    declared_qty: positiveNumber,
    weight_kg: z.string().trim().refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'validation.number').transform((v) => (v === '' ? 0 : Number(v))),
    storage_type: z.string().transform((v) => (v === '' ? null : (v as (typeof Constants.public.Enums.storage_type)[number]))),
    required_temp_c: optionalNumber,
    remarks: optionalText(300),
  })
  .superRefine((v, ctx) => {
    if (v.storage_type === null && v.required_temp_c === null) {
      ctx.addIssue({ code: 'custom', path: ['storage_type'], message: 'validation.storageOrTemp' })
    }
    if (v.mfg_date && v.expiry_date && v.expiry_date < v.mfg_date) {
      ctx.addIssue({ code: 'custom', path: ['expiry_date'], message: 'validation.expiryBeforeMfg' })
    }
  })
export type GateLineInput = z.input<typeof gateLineSchema>
export type GateLineOutput = z.output<typeof gateLineSchema>

export const emptyGateLine: GateLineInput = {
  item_name: '', sku: '', batch_no: '', mfg_date: '', expiry_date: '', packages: '', unit: 'BOX', declared_qty: '', weight_kg: '',
  storage_type: '', required_temp_c: '', remarks: '',
}
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
export const gateLineToForm = (l: GateEntryLine): GateLineInput => ({
  item_name: l.item_name, sku: str(l.sku), batch_no: str(l.batch_no), mfg_date: str(l.mfg_date), expiry_date: str(l.expiry_date),
  packages: String(l.packages), unit: l.unit, declared_qty: String(l.declared_qty), weight_kg: String(l.weight_kg),
  storage_type: str(l.storage_type), required_temp_c: str(l.required_temp_c), remarks: str(l.remarks),
})

/** Short summary for lists: "3 lines · 170 packages · 1.8 t" */
export function loadSummary(lines: Pick<GateEntryLine, 'packages' | 'weight_kg'>[]) {
  return {
    lines: lines.length,
    packages: lines.reduce((n, l) => n + l.packages, 0),
    tonnes: Math.round(lines.reduce((n, l) => n + Number(l.weight_kg), 0)) / 1000,
  }
}
