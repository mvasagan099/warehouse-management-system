import { describe, expect, it } from 'vitest'
import { lineTotals, placementProblems, type LineCount, type Placement } from './receive'

const line = { id: 'l1', declared_qty: 20 }
const counts = (o: Partial<LineCount> = {}): Record<string, LineCount> => ({ l1: { accepted: '15', damaged: '5', remarks: '', ...o } })
const p = (o: Partial<Placement>): Placement => ({ key: Math.random().toString(), line_id: 'l1', slot_id: 's1', quantity: '15', condition: 'GOOD', ...o })

describe('inward receipt form', () => {
  it('computes short quantity from declared - accepted - damaged', () => {
    expect(lineTotals(line, { accepted: '15', damaged: '3', remarks: '' })).toMatchObject({ declared: 20, accepted: 15, damaged: 3, short: 2, valid: true })
    expect(lineTotals(line, { accepted: '20', damaged: '0', remarks: '' }).short).toBe(0)
    expect(lineTotals(line, { accepted: '25', damaged: '0', remarks: '' }).short).toBe(0) // over-delivery is not "short"
  })
  it('rejects negative or non-numeric counts', () => {
    expect(lineTotals(line, { accepted: '-1', damaged: '0', remarks: '' }).valid).toBe(false)
    expect(lineTotals(line, { accepted: 'abc', damaged: '0', remarks: '' }).valid).toBe(false)
  })
  it('is satisfied when placed good + damaged equal the counts', () => {
    const r = placementProblems([line], counts(), [p({ quantity: '15' }), p({ quantity: '5', condition: 'DAMAGED' })])
    expect(r.l1).toBeNull()
  })
  it('flags missing, wrong or unassigned placements', () => {
    expect(placementProblems([line], counts(), [p({ quantity: '10' }), p({ quantity: '5', condition: 'DAMAGED' })]).l1).toBe('good')
    expect(placementProblems([line], counts(), [p({ quantity: '15' })]).l1).toBe('damaged')
    expect(placementProblems([line], counts(), [p({ slot_id: '' }), p({ quantity: '5', condition: 'DAMAGED' })]).l1).toBe('noSlot')
    expect(placementProblems([line], counts({ accepted: 'x' }), []).l1).toBe('invalid')
  })
  it('splits a line over several slots', () => {
    const r = placementProblems([line], counts({ accepted: '20', damaged: '0' }), [p({ quantity: '12' }), p({ slot_id: 's2', quantity: '8' })])
    expect(r.l1).toBeNull()
  })
})
