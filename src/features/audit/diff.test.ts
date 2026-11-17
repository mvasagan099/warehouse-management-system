import { describe, expect, it } from 'vitest'
import { changedFields, displayValue } from './diff'

describe('audit diff', () => {
  it('lists only changed fields and ignores updated_at', () => {
    const changes = changedFields(
      { name: 'Dry A', temp_min: null, updated_at: '1' },
      { name: 'Dry A (renamed)', temp_min: null, updated_at: '2' },
    )
    expect(changes).toEqual([{ field: 'name', before: 'Dry A', after: 'Dry A (renamed)' }])
  })
  it('treats inserts as all-new fields', () => {
    expect(changedFields(null, { a: 1, b: 'x' }).map((c) => c.field)).toEqual(['a', 'b'])
  })
  it('formats values', () => {
    expect(displayValue(null)).toBe('—')
    expect(displayValue({ a: 1 })).toBe('{"a":1}')
  })
})
