import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatTemperatureRange, percent } from './format'

describe('date formatting (UTC stored, Asia/Kolkata shown)', () => {
  it('shifts UTC timestamps by +05:30', () => {
    // 20:00 UTC on 31 Dec is 01:30 IST on 1 Jan
    expect(formatDateTime('2026-12-31T20:00:00Z')).toMatch(/01 Jan 2027.*01:30/i)
    expect(formatDate('2026-12-31T20:00:00Z')).toBe('01 Jan 2027')
  })
  it('handles missing / invalid input', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDate('not a date')).toBe('—')
  })
})

describe('formatTemperatureRange', () => {
  it('shows a range or a dash for dry zones', () => {
    expect(formatTemperatureRange(-25, -18)).toBe('-25 °C to -18 °C')
    expect(formatTemperatureRange(null, null)).toBe('—')
  })
})

describe('percent', () => {
  it('rounds to one decimal and is safe for zero totals', () => {
    expect(percent(1, 3)).toBe(33.3)
    expect(percent(5, 0)).toBe(0)
  })
})
