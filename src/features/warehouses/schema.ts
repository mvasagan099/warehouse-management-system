import { z } from 'zod'
import { optionalEmail, optionalNumber, optionalPhone, optionalText, requiredText } from '../../lib/zod'
import type { TablesInsert, Warehouse } from '../../lib/types'

export const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === '' || /^[A-Z0-9]{1,10}$/.test(v), 'validation.code'),
  name: requiredText(150),
  address_line1: optionalText(200),
  address_line2: optionalText(200),
  city: optionalText(100),
  district: optionalText(100),
  state: requiredText(100),
  pincode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[1-9][0-9]{5}$/.test(v), 'validation.pincode')
    .transform((v) => (v === '' ? null : v)),
  latitude: optionalNumber.refine((v) => v === null || (v >= -90 && v <= 90), 'validation.latitude'),
  longitude: optionalNumber.refine((v) => v === null || (v >= -180 && v <= 180), 'validation.longitude'),
  total_area_sqft: optionalNumber.refine((v) => v === null || v >= 0, 'validation.positive'),
  contact_name: optionalText(150),
  contact_phone: optionalPhone,
  contact_email: optionalEmail,
  opens_at: z.string().transform((v) => (v === '' ? null : v)),
  closes_at: z.string().transform((v) => (v === '' ? null : v)),
  is_24x7: z.boolean(),
  operating_notes: optionalText(300),
})

export type WarehouseFormInput = z.input<typeof warehouseSchema>
export type WarehouseFormOutput = z.output<typeof warehouseSchema>

export const emptyWarehouse: WarehouseFormInput = {
  code: '',
  name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  district: '',
  state: 'Tamil Nadu',
  pincode: '',
  latitude: '',
  longitude: '',
  total_area_sqft: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  opens_at: '',
  closes_at: '',
  is_24x7: false,
  operating_notes: '',
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

export function toFormValues(w: Warehouse): WarehouseFormInput {
  return {
    code: w.code,
    name: w.name,
    address_line1: str(w.address_line1),
    address_line2: str(w.address_line2),
    city: str(w.city),
    district: str(w.district),
    state: w.state,
    pincode: str(w.pincode),
    latitude: str(w.latitude),
    longitude: str(w.longitude),
    total_area_sqft: str(w.total_area_sqft),
    contact_name: str(w.contact_name),
    contact_phone: str(w.contact_phone),
    contact_email: str(w.contact_email),
    opens_at: w.opens_at ? w.opens_at.slice(0, 5) : '',
    closes_at: w.closes_at ? w.closes_at.slice(0, 5) : '',
    is_24x7: w.is_24x7,
    operating_notes: str(w.operating_notes),
  }
}

/** Build the insert/update payload; an empty code lets the database generate W<n>. */
export function toPayload(v: WarehouseFormOutput): TablesInsert<'warehouses'> {
  const { code, ...rest } = v
  return code ? { ...rest, code } : rest
}
