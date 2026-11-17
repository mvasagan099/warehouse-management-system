import { describe, expect, it } from 'vitest'
import { clientSchema, companySchema, contractSchema, emptyClient, emptyCompany, emptyContract, paiseToRupeesInput } from './schema'

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => `${String(i.path[0])}:${i.message}`)

describe('client form', () => {
  it('accepts a minimal client and stores the credit limit as integer paise', () => {
    const r = clientSchema.parse({ ...emptyClient, company_name: 'Sri Foods', credit_limit_paise: '1,50,000.50' })
    expect(r.credit_limit_paise).toBe(15000050)
    expect(Number.isInteger(r.credit_limit_paise)).toBe(true)
    expect(r.gstin).toBeNull()
  })
  it('validates GSTIN format and checksum', () => {
    expect(issues(clientSchema.safeParse({ ...emptyClient, company_name: 'X', gstin: '33AABCT1332L1ZL' }))).toEqual([])
    expect(issues(clientSchema.safeParse({ ...emptyClient, company_name: 'X', gstin: '33AABCT1332L1ZZ' }))).toEqual(['gstin:validation.gstin'])
    expect(issues(clientSchema.safeParse({ ...emptyClient, company_name: 'X', gstin: '123' }))).toEqual(['gstin:validation.gstin'])
  })
  it('upper-cases GSTIN and PAN', () => {
    const r = clientSchema.parse({ ...emptyClient, company_name: 'X', gstin: '33aabct1332l1zl', pan: 'aabct1332l' })
    expect(r.gstin).toBe('33AABCT1332L1ZL')
    expect(r.pan).toBe('AABCT1332L')
  })
  it('requires the PAN to match the PAN inside the GSTIN', () => {
    expect(issues(clientSchema.safeParse({ ...emptyClient, company_name: 'X', gstin: '33AABCT1332L1ZL', pan: 'ABCDE1234F' }))).toEqual(['pan:validation.panMismatch'])
  })
  it('validates PAN, PIN code, email and phone', () => {
    const bad = clientSchema.safeParse({ ...emptyClient, company_name: 'X', pan: 'BAD', pincode: '012345', email: 'nope', phone: 'abc' })
    expect(issues(bad).sort()).toEqual(['email:validation.email', 'pan:validation.pan', 'phone:validation.phone', 'pincode:validation.pincode'])
  })
  it('rejects an invalid amount', () => {
    expect(issues(clientSchema.safeParse({ ...emptyClient, company_name: 'X', credit_limit_paise: '12.345' }))).toEqual(['credit_limit_paise:validation.amount'])
  })
  it('round-trips paise to a rupee input', () => {
    expect(paiseToRupeesInput(15000050)).toBe('150000.50')
    expect(paiseToRupeesInput(250000)).toBe('2500')
  })
})

describe('company and contract forms', () => {
  it('validates a company GSTIN', () => {
    expect(issues(companySchema.safeParse({ ...emptyCompany, name: 'Receiver Mart', gstin: '27AAPFU0939F1ZV' }))).toEqual([])
    expect(issues(companySchema.safeParse({ ...emptyCompany, name: 'Receiver Mart', gstin: '27AAPFU0939F1ZX' }))).toEqual(['gstin:validation.gstin'])
  })
  it('parses a contract with deposit in paise and a default notice period', () => {
    const r = contractSchema.parse({ ...emptyContract('w1'), security_deposit_paise: '50000', notice_period_days: '' })
    expect(r.security_deposit_paise).toBe(5000000)
    expect(r.notice_period_days).toBe(30)
  })
  it('rejects an end date before the start date and a missing warehouse', () => {
    expect(issues(contractSchema.safeParse({ ...emptyContract('w1'), start_date: '2027-01-10', end_date: '2027-01-01' }))).toEqual(['end_date:validation.endBeforeStart'])
    expect(issues(contractSchema.safeParse(emptyContract('')))).toEqual(['warehouse_id:validation.required'])
  })
})
