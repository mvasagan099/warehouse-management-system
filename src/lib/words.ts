// Indian-format amount helpers used on invoices (English only; money is integer paise).
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
  'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function below1000(n: number): string {
  const parts: string[] = []
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} Hundred`); n %= 100 }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''))
  else if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

/** Whole number in Indian words: crore, lakh, thousand. 0 -> "Zero". */
export function numberToIndianWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Not a non-negative integer: ${n}`)
  if (n === 0) return 'Zero'
  const units: [number, string][] = [[10_000_000, 'Crore'], [100_000, 'Lakh'], [1000, 'Thousand']]
  const parts: string[] = []
  for (const [size, name] of units) {
    if (n >= size) { parts.push(`${below1000(Math.floor(n / size))} ${name}`); n %= size }
  }
  if (n > 0) parts.push(below1000(n))
  return parts.join(' ')
}

/** 12500050 paise -> "Rupees One Lakh Twenty-Five Thousand and Fifty Paise Only". */
export function amountInWords(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new Error('Money must be an integer number of paise')
  const negative = paise < 0
  const abs = Math.abs(paise)
  const rupees = Math.floor(abs / 100)
  const ps = abs % 100
  let s = `Rupees ${numberToIndianWords(rupees)}`
  if (ps > 0) s += ` and ${numberToIndianWords(ps)} Paise`
  return `${negative ? 'Minus ' : ''}${s} Only`
}

/** 12500000 paise -> "1,25,000.00" (Indian grouping, no currency symbol: the PDF font has no rupee glyph). */
export function formatIndian(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new Error('Money must be an integer number of paise')
  const abs = Math.abs(paise)
  const rupees = String(Math.floor(abs / 100))
  const last3 = rupees.slice(-3)
  const rest = rupees.slice(0, -3)
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3
  return `${paise < 0 ? '-' : ''}${grouped}.${String(abs % 100).padStart(2, '0')}`
}

/** Basis points to a percentage string: 1800 -> "18%", 925 -> "9.25%". */
export function bpToPercent(bp: number): string {
  const v = bp / 100
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0+$/, '')}%`
}
