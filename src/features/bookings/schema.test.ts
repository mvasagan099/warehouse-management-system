import { describe, expect, it } from 'vitest'
import { bookingSchema, emptyBooking } from './schema'

const base = { ...emptyBooking('c1', 'w1') }
const issues = (v: object) => { const r = bookingSchema.safeParse({ ...base, ...v }); return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`) }

describe('space booking form', () => {
  it('accepts an exact set-point for frozen goods', () => {
    expect(issues({ storage_type: 'FROZEN', temp_setpoint_c: '-18' })).toEqual([])
  })
  it('accepts a temperature band instead of a set-point', () => {
    expect(issues({ storage_type: 'CHILLED', temp_min: '2', temp_max: '8' })).toEqual([])
  })
  it('needs a temperature for chilled, frozen and deep freeze', () => {
    expect(issues({ storage_type: 'FROZEN' })).toEqual(['temp_setpoint_c:validation.tempRequired'])
  })
  it('forbids temperatures on dry space', () => {
    expect(issues({ storage_type: 'DRY', temp_setpoint_c: '5' })).toEqual(['temp_setpoint_c:validation.tempNotAllowed'])
    expect(issues({ storage_type: 'DRY' })).toEqual([])
  })
  it('requires both ends of a band and min <= max', () => {
    expect(issues({ storage_type: 'CHILLED', temp_min: '2' })).toEqual(['temp_max:validation.tempBoth'])
    expect(issues({ storage_type: 'CHILLED', temp_min: '9', temp_max: '2' })).toEqual(['temp_min:validation.tempOrder'])
  })
  it('requires a positive whole number of brigades', () => {
    expect(issues({ storage_type: 'DRY', brigades_requested: '0' })).toContain('brigades_requested:validation.positiveInt')
    expect(issues({ storage_type: 'DRY', brigades_requested: '2.5' })).toContain('brigades_requested:validation.positiveInt')
  })
})
