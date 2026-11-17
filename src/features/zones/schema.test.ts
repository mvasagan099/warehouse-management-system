import { describe, expect, it } from 'vitest'
import { zoneSchema, type ZoneFormInput } from './schema'

const base: ZoneFormInput = { warehouse_id: 'w1', code: '', name: 'Cold room', storage_type: 'DRY', temp_min: '', temp_max: '', notes: '' }
const issues = (v: Partial<ZoneFormInput>) => {
  const r = zoneSchema.safeParse({ ...base, ...v })
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}:${i.message}`)
}

describe('zoneSchema', () => {
  it('accepts a dry zone without temperatures and maps blanks to null', () => {
    const r = zoneSchema.parse(base)
    expect(r.temp_min).toBeNull()
    expect(r.temp_max).toBeNull()
  })
  it('accepts a -18 °C frozen zone', () => {
    const r = zoneSchema.parse({ ...base, storage_type: 'FROZEN', temp_min: '-25', temp_max: '-18', code: 'z2' })
    expect(r).toMatchObject({ temp_min: -25, temp_max: -18, code: 'Z2' })
  })
  it('rejects temperatures on a dry zone', () => {
    expect(issues({ temp_min: '2', temp_max: '8' })).toContain('temp_min:validation.tempNotAllowed')
  })
  it('requires a band for chilled / frozen / deep freeze', () => {
    expect(issues({ storage_type: 'CHILLED' })).toEqual(['temp_min:validation.tempRequired', 'temp_max:validation.tempRequired'])
  })
  it('requires min <= max', () => {
    expect(issues({ storage_type: 'FROZEN', temp_min: '-10', temp_max: '-20' })).toContain('temp_min:validation.tempOrder')
  })
  it('allows bonded zones with no band, but not half a band', () => {
    expect(issues({ storage_type: 'BONDED' })).toEqual([])
    expect(issues({ storage_type: 'BONDED', temp_min: '5' })).toEqual(['temp_max:validation.tempBoth'])
  })
  it('validates codes', () => {
    expect(issues({ code: 'Z-1' })).toEqual(['code:validation.code'])
  })
})
