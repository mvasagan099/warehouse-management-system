import { passwordProblem } from '../../lib/password'
import { z } from 'zod'
import { isValidGstin, PAN_RE } from '../../lib/gstin'
import { rupeesToPaise } from '../../lib/money'
import { optionalEmail, optionalPhone, optionalText, requiredText } from '../../lib/zod'
import { Constants, type Client, type Company, type Contract } from '../../lib/types'

const gstinField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => v === '' || isValidGstin(v), 'validation.gstin')
  .transform((v) => (v === '' ? null : v))

const panField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => v === '' || PAN_RE.test(v), 'validation.pan')
  .transform((v) => (v === '' ? null : v))

const pincodeField = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[1-9][0-9]{5}$/.test(v), 'validation.pincode')
  .transform((v) => (v === '' ? null : v))

/** Rupees typed by the user ("1,00,000.50") -> integer paise. Never floats. */
const rupeesField = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[\d,]+(\.\d{1,2})?$/.test(v), 'validation.amount')
  .transform((v) => (v === '' ? 0 : rupeesToPaise(v)))

const gstConsistency = (v: { gstin: string | null; pan: string | null }, ctx: z.RefinementCtx) => {
  if (v.gstin && v.pan && v.gstin.slice(2, 12) !== v.pan) {
    ctx.addIssue({ code: 'custom', path: ['pan'], message: 'validation.panMismatch' })
  }
}

export const clientSchema = z
  .object({
    company_name: requiredText(200),
    gstin: gstinField,
    pan: panField,
    address_line1: optionalText(200),
    address_line2: optionalText(200),
    city: optionalText(100),
    district: optionalText(100),
    state: optionalText(100),
    pincode: pincodeField,
    contact_name: optionalText(150),
    phone: optionalPhone,
    email: optionalEmail,
    credit_limit_paise: rupeesField,
    pick_rule: z.enum(Constants.public.Enums.pick_rule),
    status: z.enum(Constants.public.Enums.client_status),
    notes: optionalText(500),
    group_id: z.string().trim().transform((v) => (v === '' ? null : v)),
    billing_cycle: z.enum(Constants.public.Enums.billing_cycle),
    billing_mode: z.enum(Constants.public.Enums.billing_mode),
    payment_terms_days: z.string().trim().refine((v) => /^\d{1,3}$/.test(v), 'validation.days').transform(Number),
    gst_exempt: z.boolean(),
    gst_exempt_reason: optionalText(200),
    login_password: z.string().optional().transform((v) => (v ?? '').trim()),
  })
  .superRefine(gstConsistency)
  .superRefine((v, ctx) => {
    if (!v.login_password) return
    if (!v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'validation.required' })
    const problem = passwordProblem(v.login_password)
    if (problem) ctx.addIssue({ code: 'custom', path: ['login_password'], message: problem })
  })
  .superRefine((v, ctx) => {
    if (v.gst_exempt && !v.gst_exempt_reason) ctx.addIssue({ code: 'custom', path: ['gst_exempt_reason'], message: 'validation.required' })
  })
  .transform((v) => ({ ...v, gst_exempt_reason: v.gst_exempt ? v.gst_exempt_reason : null }))

export type ClientFormInput = z.input<typeof clientSchema>
export type ClientFormOutput = z.output<typeof clientSchema>

export const emptyClient: ClientFormInput = {
  company_name: '', gstin: '', pan: '', address_line1: '', address_line2: '', city: '', district: '', state: '',
  pincode: '', contact_name: '', phone: '', email: '', credit_limit_paise: '', pick_rule: 'FEFO', status: 'ACTIVE', notes: '',
  group_id: '', billing_cycle: 'MONTHLY', billing_mode: 'BOTH', payment_terms_days: '15', gst_exempt: false, gst_exempt_reason: '', login_password: '',
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
export const paiseToRupeesInput = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2))

export function clientToForm(c: Client): ClientFormInput {
  return {
    company_name: c.company_name, gstin: str(c.gstin), pan: str(c.pan), address_line1: str(c.address_line1),
    address_line2: str(c.address_line2), city: str(c.city), district: str(c.district), state: str(c.state),
    pincode: str(c.pincode), contact_name: str(c.contact_name), phone: str(c.phone), email: str(c.email),
    credit_limit_paise: paiseToRupeesInput(c.credit_limit_paise), pick_rule: c.pick_rule, status: c.status, notes: str(c.notes),
    group_id: str(c.group_id), billing_cycle: c.billing_cycle, billing_mode: c.billing_mode, payment_terms_days: String(c.payment_terms_days),
    gst_exempt: c.gst_exempt, gst_exempt_reason: str(c.gst_exempt_reason), login_password: '',
  }
}

// ---------- company master (sender / receiver) ----------
export const companySchema = z
  .object({
    name: requiredText(200),
    kind: z.enum(Constants.public.Enums.company_kind),
    gstin: gstinField,
    pan: panField,
    address_line1: optionalText(200),
    address_line2: optionalText(200),
    city: optionalText(100),
    district: optionalText(100),
    state: optionalText(100),
    pincode: pincodeField,
    contact_name: optionalText(150),
    phone: optionalPhone,
    email: optionalEmail,
  })
  .superRefine(gstConsistency)
export type CompanyFormInput = z.input<typeof companySchema>
export type CompanyFormOutput = z.output<typeof companySchema>
export const emptyCompany: CompanyFormInput = {
  name: '', kind: 'BOTH', gstin: '', pan: '', address_line1: '', address_line2: '', city: '', district: '',
  state: '', pincode: '', contact_name: '', phone: '', email: '',
}
export function companyToForm(c: Company): CompanyFormInput {
  return {
    name: c.name, kind: c.kind, gstin: str(c.gstin), pan: str(c.pan), address_line1: str(c.address_line1),
    address_line2: str(c.address_line2), city: str(c.city), district: str(c.district), state: str(c.state),
    pincode: str(c.pincode), contact_name: str(c.contact_name), phone: str(c.phone), email: str(c.email),
  }
}

// ---------- contract ----------
export const contractSchema = z
  .object({
    warehouse_id: z.string().min(1, 'validation.required'),
    contract_no: optionalText(40),
    start_date: z.string().min(1, 'validation.required'),
    end_date: z.string().transform((v) => (v === '' ? null : v)),
    min_days: z.string().trim().refine((v) => v === '' || /^\d+$/.test(v), 'validation.positiveInt').transform((v) => (v === '' ? 0 : Number(v))),
    committed_brigades: z.string().trim().refine((v) => v === '' || /^\d+$/.test(v), 'validation.positiveInt').transform((v) => (v === '' ? 0 : Number(v))),
    security_deposit_paise: rupeesField,
    notice_period_days: z.string().trim().refine((v) => v === '' || /^\d+$/.test(v), 'validation.positiveInt').transform((v) => (v === '' ? 30 : Number(v))),
    status: z.enum(Constants.public.Enums.contract_status),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { path: ['end_date'], message: 'validation.endBeforeStart' })
export type ContractFormInput = z.input<typeof contractSchema>
export type ContractFormOutput = z.output<typeof contractSchema>
export const emptyContract = (warehouseId = ''): ContractFormInput => ({
  warehouse_id: warehouseId, contract_no: '', start_date: new Date().toISOString().slice(0, 10), end_date: '',
  min_days: '', committed_brigades: '', security_deposit_paise: '', notice_period_days: '30', status: 'ACTIVE',
})
export function contractToForm(c: Contract): ContractFormInput {
  return {
    warehouse_id: c.warehouse_id, contract_no: str(c.contract_no), start_date: c.start_date, end_date: str(c.end_date),
    min_days: String(c.min_days), committed_brigades: String(c.committed_brigades),
    security_deposit_paise: paiseToRupeesInput(c.security_deposit_paise), notice_period_days: String(c.notice_period_days),
    status: c.status,
  }
}
