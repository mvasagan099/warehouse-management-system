import { describe, expect, it } from 'vitest'
import { MAX_SLOTS_PER_REQUEST, slotBuilderSchema, slotCode, slotPreview } from './schema'

describe('slot codes', () => {
  it('match the database format W1-Z2-A3-R4-L2-B07', () => {
    expect(slotCode('W1', 'Z2', 3, 4, 2, 7)).toBe('W1-Z2-A3-R4-L2-B07')
  })
  it('previews 10 x 5 x 2 x 1 = 100 slots', () => {
    expect(slotPreview({ aisles: 10, racks: 5, levels: 2, slots_per_level: 1, aisle_start: 1 }, 'W1', 'Z2')).toEqual({
      count: 100,
      first: 'W1-Z2-A1-R1-L1-B01',
      last: 'W1-Z2-A10-R5-L2-B01',
    })
  })
  it('respects the start aisle when extending a layout', () => {
    expect(slotPreview({ aisles: 2, racks: 1, levels: 1, slots_per_level: 3, aisle_start: 11 }, 'W1', 'Z1').last).toBe('W1-Z1-A12-R1-L1-B03')
  })
})

describe('slotBuilderSchema', () => {
  const base = { warehouse_id: 'w', zone_id: 'z', brigade_type_id: 'b', aisles: '10', racks: '5', levels: '2', slots_per_level: '1', aisle_start: '1' }
  it('parses numbers', () => {
    expect(slotBuilderSchema.parse(base)).toMatchObject({ aisles: 10, racks: 5, levels: 2 })
  })
  it('rejects zero / fractional dimensions', () => {
    expect(slotBuilderSchema.safeParse({ ...base, racks: '0' }).success).toBe(false)
    expect(slotBuilderSchema.safeParse({ ...base, levels: '1.5' }).success).toBe(false)
  })
  it(`caps a single request at ${MAX_SLOTS_PER_REQUEST} slots`, () => {
    const r = slotBuilderSchema.safeParse({ ...base, aisles: '100', racks: '100', levels: '3' })
    expect(r.success).toBe(false)
  })
})
