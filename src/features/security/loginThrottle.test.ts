import { beforeEach, describe, expect, it } from 'vitest'
import { LOCK_MS, lockedFor, MAX_FAILS, recordFailure, recordSuccess } from './loginThrottle'

describe('login throttle', () => {
  beforeEach(() => localStorage.clear())
  it('locks after five failures and unlocks after five minutes', () => {
    const t0 = 1_000_000
    for (let i = 0; i < MAX_FAILS - 1; i++) recordFailure(t0 + i)
    expect(lockedFor(t0 + 10)).toBe(0)
    recordFailure(t0 + 5)
    expect(lockedFor(t0 + 10)).toBeGreaterThan(LOCK_MS - 100)
    expect(lockedFor(t0 + 5 + LOCK_MS + 1)).toBe(0)
  })
  it('a successful sign-in clears the count', () => {
    for (let i = 0; i < MAX_FAILS; i++) recordFailure(2_000_000 + i)
    recordSuccess()
    expect(lockedFor(2_000_100)).toBe(0)
  })
  it('old failures expire', () => {
    for (let i = 0; i < MAX_FAILS; i++) recordFailure(3_000_000 + i)
    expect(lockedFor(3_000_000 + 16 * 60_000)).toBe(0)
  })
})
