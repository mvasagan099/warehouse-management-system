import { describe, expect, it } from 'vitest'
import { amountInWords, bpToPercent, formatIndian, numberToIndianWords } from './words'

describe('Indian amount helpers', () => {
  it('writes numbers in lakh and crore words', () => {
    expect(numberToIndianWords(0)).toBe('Zero')
    expect(numberToIndianWords(19)).toBe('Nineteen')
    expect(numberToIndianWords(125000)).toBe('One Lakh Twenty-Five Thousand')
    expect(numberToIndianWords(10_000_000)).toBe('One Crore')
    expect(numberToIndianWords(123_456_789)).toBe('Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine')
  })
  it('writes an invoice amount in words', () => {
    expect(amountInWords(12_500_000)).toBe('Rupees One Lakh Twenty-Five Thousand Only')
    expect(amountInWords(12_500_050)).toBe('Rupees One Lakh Twenty-Five Thousand and Fifty Paise Only')
    expect(amountInWords(100)).toBe('Rupees One Only')
    expect(amountInWords(5)).toBe('Rupees Zero and Five Paise Only')
  })
  it('formats with Indian digit grouping', () => {
    expect(formatIndian(12_500_000)).toBe('1,25,000.00')
    expect(formatIndian(123_456_789)).toBe('12,34,567.89')
    expect(formatIndian(99_999)).toBe('999.99')
    expect(formatIndian(100_000)).toBe('1,000.00')
    expect(formatIndian(-250_050)).toBe('-2,500.50')
    expect(formatIndian(0)).toBe('0.00')
  })
  it('rejects fractional paise', () => {
    expect(() => formatIndian(10.5)).toThrow()
  })
  it('prints GST rates', () => {
    expect(bpToPercent(1800)).toBe('18%')
    expect(bpToPercent(925)).toBe('9.25%')
    expect(bpToPercent(250)).toBe('2.5%')
  })
})
