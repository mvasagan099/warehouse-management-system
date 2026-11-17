import { describe, expect, it } from 'vitest'
import { emptyGate, emptyGateLine, gateEntrySchema, gateLineSchema, loadSummary, normaliseLorry } from './schema'

const gate = (o: object = {}) => ({ ...emptyGate('INWARD', 'w1', 'c1'), lorry_number: 'TN 01 AB-1234', ...o })
const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => r.success ? [] : (r.error?.issues ?? []).map((i) => `${String(i.path[0])}:${i.message}`)

describe('lorry gate entry', () => {
  it('normalises lorry numbers', () => {
    expect(normaliseLorry('tn 01 ab-1234')).toBe('TN01AB1234')
    expect(gateEntrySchema.parse(gate()).lorry_number).toBe('TN01AB1234')
  })
  it('rejects a lorry number that is too short or empty', () => {
    expect(issues(gateEntrySchema.safeParse(gate({ lorry_number: 'TN1' })))).toEqual(['lorry_number:validation.lorry'])
    expect(issues(gateEntrySchema.safeParse(gate({ lorry_number: '' })))).toEqual(['lorry_number:validation.lorry'])
  })
  it('validates the 12 digit e-way bill and ignores spaces', () => {
    expect(gateEntrySchema.parse(gate({ eway_bill_number: '1234 5678 9012' })).eway_bill_number).toBe('123456789012')
    expect(issues(gateEntrySchema.safeParse(gate({ eway_bill_number: '12345' })))).toEqual(['eway_bill_number:validation.eway'])
  })
  it('turns blanks into null and the e-way expiry into an ISO time', () => {
    const r = gateEntrySchema.parse(gate({ eway_valid_until: '2027-01-02T10:30', driver_phone: '' }))
    expect(r.driver_phone).toBeNull()
    expect(r.eway_valid_until).toMatch(/^2027-01-02T\d{2}:\d{2}:00.000Z$/)
  })
  it('needs a client and a warehouse', () => {
    expect(issues(gateEntrySchema.safeParse({ ...gate(), client_id: '', warehouse_id: '' })).sort()).toEqual(['client_id:validation.required', 'warehouse_id:validation.required'])
  })
})

describe('load line', () => {
  const line = (o: object = {}) => ({ ...emptyGateLine, item_name: 'Frozen peas', declared_qty: '100', storage_type: 'FROZEN', ...o })
  it('accepts a line with a storage type or a required temperature', () => {
    expect(gateLineSchema.safeParse(line()).success).toBe(true)
    expect(gateLineSchema.safeParse(line({ storage_type: '', required_temp_c: '-18' })).success).toBe(true)
  })
  it('needs a storage type or a temperature', () => {
    expect(issues(gateLineSchema.safeParse(line({ storage_type: '' })))).toEqual(['storage_type:validation.storageOrTemp'])
  })
  it('needs a positive declared quantity and sensible dates', () => {
    expect(issues(gateLineSchema.safeParse(line({ declared_qty: '0' })))).toEqual(['declared_qty:validation.positive'])
    expect(issues(gateLineSchema.safeParse(line({ mfg_date: '2027-02-01', expiry_date: '2027-01-01' })))).toEqual(['expiry_date:validation.expiryBeforeMfg'])
  })
  it('summarises a load', () => {
    expect(loadSummary([{ packages: 100, weight_kg: 1200 }, { packages: 50, weight_kg: 400 }, { packages: 20, weight_kg: 200 }])).toEqual({ lines: 3, packages: 170, tonnes: 1.8 })
  })
})
