// A courtesy limit in the browser (the real limit is the Auth service's own rate limit, see docs/security.md): after 5 wrong passwords the
// sign-in button waits 5 minutes. It protects people from locking themselves out by retrying, and slows a person at the keyboard.
const KEY = 'wms.loginFails'
export const MAX_FAILS = 5
export const LOCK_MS = 5 * 60_000
const WINDOW_MS = 15 * 60_000

interface State { fails: number[]; }
const read = (): State => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{"fails":[]}') as State } catch { return { fails: [] } } }
const write = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: no throttle, the server still limits */ } }

export function recordFailure(now = Date.now()) { const s = read(); write({ fails: [...s.fails.filter((t) => now - t < WINDOW_MS), now] }) }
export function recordSuccess() { write({ fails: [] }) }
/** Milliseconds left on the lock, or 0. */
export function lockedFor(now = Date.now()): number {
  const recent = read().fails.filter((t) => now - t < WINDOW_MS)
  if (recent.length < MAX_FAILS) return 0
  return Math.max(0, recent[recent.length - 1] + LOCK_MS - now)
}
