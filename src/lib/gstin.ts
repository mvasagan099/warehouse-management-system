// GSTIN: 2-digit state code + 10-char PAN + entity number + 'Z' + mod-36 check character.
// Mirrors public.is_valid_gstin() in the database.
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export function gstinCheckChar(first14: string): string {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i])
    const prod = v * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(prod / 36) + (prod % 36)
  }
  return CHARS[(36 - (sum % 36)) % 36]
}

export function isValidGstin(value: string): boolean {
  const g = value.trim().toUpperCase()
  return SHAPE.test(g) && gstinCheckChar(g) === g[14]
}

/** State code = first two digits of a GSTIN. */
export function gstinStateCode(value: string): string | null {
  const g = value.trim().toUpperCase()
  return /^[0-9]{2}/.test(g) ? g.slice(0, 2) : null
}

export function gstinPan(value: string): string | null {
  const g = value.trim().toUpperCase()
  return g.length >= 12 ? g.slice(2, 12) : null
}

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
