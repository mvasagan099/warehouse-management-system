// EXTENSION POINT (rates / invoices, Phase 2+): money is ALWAYS integer paise.
// Never use floating point rupees in storage or arithmetic.

export type Paise = number // integer; bigint columns arrive from PostgREST as numbers

export function assertPaise(value: number): Paise {
  if (!Number.isSafeInteger(value)) throw new Error(`Money must be an integer number of paise, got ${value}`)
  return value
}

/** Parse a rupee string typed by a user ("1,234.50") into integer paise without float drift. */
export function rupeesToPaise(input: string): Paise {
  const clean = input.replace(/[,\s₹]/g, '')
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(clean)
  if (!m) throw new Error(`Invalid amount: ${input}`)
  const [, sign, whole, frac = ''] = m
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return assertPaise(sign ? -paise : paise)
}

/** Format paise as Indian Rupees with Indian digit grouping, e.g. 12345678 -> ₹1,23,456.78 */
export function formatINR(paise: Paise, lang = 'en'): string {
  assertPaise(paise)
  const negative = paise < 0
  const abs = Math.abs(paise)
  const rupees = Math.trunc(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  const grouped = new Intl.NumberFormat(lang === 'ta' ? 'ta-IN' : 'en-IN').format(rupees)
  return `${negative ? '-' : ''}₹${grouped}.${fraction}`
}
