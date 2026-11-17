import { describe, expect, it } from 'vitest'
import { assertPaise, formatINR, rupeesToPaise } from './money'

describe('money is integer paise', () => {
  it('parses rupee strings without float drift', () => {
    expect(rupeesToPaise('0.1')).toBe(10)
    expect(rupeesToPaise('1,23,456.78')).toBe(12345678)
    expect(rupeesToPaise('₹ 19.99')).toBe(1999)
    expect(rupeesToPaise('-5')).toBe(-500)
  })
  it('rejects invalid amounts and fractional paise', () => {
    expect(() => rupeesToPaise('1.234')).toThrow()
    expect(() => rupeesToPaise('abc')).toThrow()
    expect(() => assertPaise(10.5)).toThrow()
  })
  it('formats with Indian digit grouping', () => {
    expect(formatINR(12345678)).toBe('₹1,23,456.78')
    expect(formatINR(5)).toBe('₹0.05')
    expect(formatINR(-150)).toBe('-₹1.50')
  })
})
