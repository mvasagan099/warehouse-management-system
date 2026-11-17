import { describe, expect, it } from 'vitest'
import { allPicked, matchPick } from './picking'

const S1 = '11111111-1111-1111-1111-111111111111'
const S2 = '22222222-2222-2222-2222-222222222222'
const L1 = '33333333-3333-3333-3333-333333333333'
const picks = [
  { id: 'p1', stock_item_id: S1, slot_id: L1, batch_no: 'B-EARLY', picked: false },
  { id: 'p2', stock_item_id: S2, slot_id: '44444444-4444-4444-4444-444444444444', batch_no: 'B-LATE', picked: false },
]

describe('matching a scan to a pick', () => {
  it('matches a pallet label, a slot label and a batch number', () => {
    expect(matchPick(picks, `WMS:STOCK:${S1}`)?.id).toBe('p1')
    expect(matchPick(picks, `WMS:SLOT:${L1}`)?.id).toBe('p1')
    expect(matchPick(picks, 'b-late')?.id).toBe('p2')
  })
  it('returns null for a batch that is not on the pick list', () => {
    expect(matchPick(picks, 'B-OTHER')).toBeNull()
    expect(matchPick(picks, 'WMS:STOCK:99999999-9999-9999-9999-999999999999')).toBeNull()
  })
  it('ignores picks that are already done', () => {
    expect(matchPick([{ ...picks[0], picked: true }, picks[1]], `WMS:STOCK:${S1}`)).toBeNull()
  })
  it('knows when everything is picked', () => {
    expect(allPicked([])).toBe(false)
    expect(allPicked([{ picked: true }, { picked: false }])).toBe(false)
    expect(allPicked([{ picked: true }, { picked: true }])).toBe(true)
  })
})
