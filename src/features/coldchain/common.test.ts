import { describe, expect, it } from 'vitest'
import { ageText, breakAtGaps, bucketMinutes, doorIntervals, sparkPath, tileStatus } from './common'

const base = { current_value: -19, last_at: '2026-11-18T10:00:00Z', temp_min: -25, temp_max: -18, sensor_count: 1, manual_only: false, offline_after_min: 15, worst_severity: null }
const now = Date.parse('2026-11-18T10:05:00Z')

describe('tile status', () => {
  it('is OK inside the range with fresh data', () => expect(tileStatus(base, now)).toBe('OK'))
  it('is OFFLINE when the last reading is older than the setting', () => expect(tileStatus(base, now + 11 * 60_000)).toBe('OFFLINE'))
  it('is CRITICAL or WARNING from the open alerts', () => {
    expect(tileStatus({ ...base, worst_severity: 'CRITICAL' }, now)).toBe('CRITICAL')
    expect(tileStatus({ ...base, worst_severity: 'WARNING' }, now)).toBe('WARNING')
  })
  it('warns when the current value is outside the target range even before an alert', () => expect(tileStatus({ ...base, current_value: -12 }, now)).toBe('WARNING'))
  it('has no status without sensors, and manual-only zones go stale after 12 hours', () => {
    expect(tileStatus({ ...base, sensor_count: 0, last_at: null }, now)).toBe('NO_SENSOR')
    expect(tileStatus({ ...base, manual_only: true }, now + 3 * 3600_000)).toBe('OK')
    expect(tileStatus({ ...base, manual_only: true }, now + 13 * 3600_000)).toBe('OFFLINE')
  })
  it('never shows an old value as current when nothing was ever received', () => expect(tileStatus({ ...base, last_at: null }, now)).toBe('OFFLINE'))
})

describe('gaps are never bridged', () => {
  const pts = [{ t: 0, v: 1 }, { t: 60_000, v: 2 }, { t: 600_000, v: 3 }]
  it('inserts a null point at a gap', () => {
    const out = breakAtGaps(pts, 300_000)
    expect(out.map((p) => p.v)).toEqual([1, 2, null, 3])
    expect(breakAtGaps(pts.slice(0, 2), 300_000)).toHaveLength(2)
  })
  it('starts a new sparkline segment after a gap', () => {
    expect((sparkPath(pts, 100, 20, 300_000).match(/M/g) ?? []).length).toBe(2)
    expect(sparkPath([], 100, 20, 1000)).toBe('')
  })
})

describe('door intervals and helpers', () => {
  it('turns open/closed readings into intervals', () => {
    expect(doorIntervals([{ t: 1, v: 1 }, { t: 2, v: 1 }, { t: 5, v: 0 }, { t: 8, v: 1 }], 10)).toEqual([{ from: 1, to: 5 }, { from: 8, to: 10 }])
  })
  it('formats ages and chart buckets', () => {
    expect(ageText('2026-11-18T10:00:00Z', now)).toBe('5 min')
    expect(ageText(null, now)).toBe('—')
    expect(ageText('2026-11-18T07:00:00Z', now)).toBe('3 h 5 min')
    expect(bucketMinutes(6 * 3600_000)).toBe(2)
    expect(bucketMinutes(30 * 86_400_000)).toBe(144)
  })
})
