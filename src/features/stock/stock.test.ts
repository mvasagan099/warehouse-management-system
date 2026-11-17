import { describe, expect, it } from 'vitest'
import { daysUntil, expiringSoon, expiryState, groupBySlot, todayIST } from './stock'

describe('stock helpers', () => {
  it('counts days between calendar dates', () => {
    expect(daysUntil('2027-01-31', '2027-01-01')).toBe(30)
    expect(daysUntil('2026-12-31', '2027-01-01')).toBe(-1)
    expect(daysUntil('2027-03-01', '2027-02-01')).toBe(28)
  })
  it('classifies expiry with a configurable window', () => {
    expect(expiryState(null, 30, '2027-01-01')).toBe('none')
    expect(expiryState('2026-12-31', 30, '2027-01-01')).toBe('expired')
    expect(expiryState('2027-01-31', 30, '2027-01-01')).toBe('soon')
    expect(expiryState('2027-01-31', 10, '2027-01-01')).toBe('ok')
  })
  it('lists expiring items soonest first and ignores empty stock', () => {
    const items = [
      { expiry_date: '2027-02-10', quantity: 5 }, { expiry_date: '2027-01-05', quantity: 1 },
      { expiry_date: '2027-01-02', quantity: 0 }, { expiry_date: null, quantity: 9 }, { expiry_date: '2027-06-01', quantity: 9 },
    ]
    expect(expiringSoon(items, 45, '2027-01-01').map((i) => i.expiry_date)).toEqual(['2027-01-05', '2027-02-10'])
  })
  it('groups stock by slot', () => {
    const g = groupBySlot([{ slot_code: 'B2' }, { slot_code: 'A1' }, { slot_code: 'B2' }])
    expect(g.map((x) => [x.slot, x.items.length])).toEqual([['A1', 1], ['B2', 2]])
  })
  it('uses the India calendar day around midnight UTC', () => {
    expect(todayIST(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01') // 01:30 IST next day
    expect(todayIST(new Date('2026-12-31T10:00:00Z'))).toBe('2026-12-31')
  })
})
