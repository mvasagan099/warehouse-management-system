import type { InvoiceStatus } from '../../lib/types'

export const STATUS_TONE: Record<InvoiceStatus, 'gray' | 'green' | 'red' | 'amber' | 'blue'> = {
  DRAFT: 'gray', ISSUED: 'blue', PARTIALLY_PAID: 'amber', PAID: 'green', OVERDUE: 'red', CANCELLED: 'gray',
}

export const STORAGE_TYPES = ['DRY', 'CHILLED', 'FROZEN', 'DEEP_FREEZE', 'BONDED', 'HAZMAT'] as const
export const LABOUR_ACTIVITIES = ['UNLOADING', 'LOADING', 'SORTING', 'STACKING', 'LABELLING', 'PICKING', 'PACKING'] as const
export const LABOUR_BASES = ['PER_PACKAGE', 'PER_TONNE', 'PER_BRIGADE_MOVED', 'PER_HOUR', 'FLAT_PER_LORRY'] as const
/** Hand cash only for now. Other methods (UPI, bank, cheque, deposit adjustment) stay in the database but are not offered. */
export const PAYMENT_METHODS = ['CASH'] as const
/** Online payment (Razorpay link / client Pay online) is switched off. */
export const ONLINE_PAYMENTS = false

/** What is still owed on an invoice, in paise. */
export const owed = (i: { grand_total_paise: number; paid_paise: number; credit_paise: number }) => i.grand_total_paise - i.paid_paise - i.credit_paise

/** A multiplier stored in basis points (10000 = x1.00) shown as "x1.50". */
export const multiplierLabel = (bp: number) => `×${(bp / 10000).toFixed(2)}`

/** Percent typed by a person ("12.5") to basis points (1250) without float drift. */
export function percentToBp(input: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim())
  if (!m) throw new Error(`Invalid percentage: ${input}`)
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
}

/** Escape one CSV cell (quotes, commas and line breaks; leading = + - @ are neutralised against spreadsheet formulas). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Paise as plain rupees for a CSV ("1250.50"), never a float. */
export const paiseToRupeeText = (p: number) => `${p < 0 ? '-' : ''}${Math.floor(Math.abs(p) / 100)}.${String(Math.abs(p) % 100).padStart(2, '0')}`
