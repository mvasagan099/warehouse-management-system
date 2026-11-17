import { describe, expect, it } from 'vitest'
import { gstinCheckChar, gstinPan, gstinStateCode, isValidGstin } from './gstin'

// Published sample GSTINs with correct check characters.
const GOOD = ['27AAPFU0939F1ZV', '33AABCT1332L1ZL', '33AAACR5055K1ZE']

describe('GSTIN validation', () => {
  it('accepts real-format GSTINs with the right check character', () => {
    for (const g of GOOD) expect(isValidGstin(g)).toBe(true)
  })
  it('is case-insensitive and ignores surrounding spaces', () => {
    expect(isValidGstin(' 27aapfu0939f1zv ')).toBe(true)
  })
  it('rejects a wrong check character', () => {
    expect(isValidGstin('27AAPFU0939F1ZX')).toBe(false)
    expect(gstinCheckChar('27AAPFU0939F1Z')).toBe('V')
  })
  it('rejects wrong length and shape', () => {
    expect(isValidGstin('27AAPFU0939F1Z')).toBe(false)     // 14 characters
    expect(isValidGstin('27AAPFU0939F1ZVV')).toBe(false)   // 16 characters
    expect(isValidGstin('AAAAAAAAAAAAAAA')).toBe(false)    // no state digits
    expect(isValidGstin('27AAPFU0939F1AV')).toBe(false)    // 14th must be Z
    expect(isValidGstin('')).toBe(false)
  })
  it('reads the state code and PAN from the GSTIN', () => {
    expect(gstinStateCode('33AABCT1332L1ZL')).toBe('33') // Tamil Nadu
    expect(gstinPan('33AABCT1332L1ZL')).toBe('AABCT1332L')
    expect(gstinStateCode('')).toBeNull()
  })
})
