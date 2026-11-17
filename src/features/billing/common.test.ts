import { describe, expect, it } from 'vitest'
import { csvCell, multiplierLabel, owed, paiseToRupeeText, percentToBp, toCsv } from './common'

describe('billing helpers', () => {
  it('computes what is owed', () => {
    expect(owed({ grand_total_paise: 100_000, paid_paise: 40_000, credit_paise: 10_000 })).toBe(50_000)
  })
  it('converts typed percentages to basis points exactly', () => {
    expect(percentToBp('18')).toBe(1800)
    expect(percentToBp('12.5')).toBe(1250)
    expect(percentToBp('0.05')).toBe(5)
    expect(() => percentToBp('abc')).toThrow()
    expect(() => percentToBp('1.234')).toThrow()
  })
  it('labels multipliers', () => { expect(multiplierLabel(15000)).toBe('×1.50') })
  it('writes safe CSV', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(null)).toBe('')
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n')
  })
  it('prints paise as rupee text', () => {
    expect(paiseToRupeeText(125_050)).toBe('1250.50')
    expect(paiseToRupeeText(-5)).toBe('-0.05')
  })
})
