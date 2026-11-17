import type { StockItem } from '../../lib/types'

export type ExpiryState = 'none' | 'expired' | 'soon' | 'ok'

const DAY = 86_400_000
const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/** Whole days from `today` until `expiry` (negative = already expired). Dates are plain calendar dates (IST). */
export function daysUntil(expiry: string, today: string): number {
  return Math.round((toDay(expiry) - toDay(today)) / DAY)
}

export function expiryState(expiry: string | null, withinDays: number, today: string): ExpiryState {
  if (!expiry) return 'none'
  const d = daysUntil(expiry, today)
  return d < 0 ? 'expired' : d <= withinDays ? 'soon' : 'ok'
}

/** Items that expire within N days (or already have), soonest first. */
export function expiringSoon<T extends Pick<StockItem, 'expiry_date' | 'quantity'>>(items: T[], withinDays: number, today: string): T[] {
  return items
    .filter((i) => i.quantity > 0 && i.expiry_date && daysUntil(i.expiry_date, today) <= withinDays)
    .sort((a, b) => (a.expiry_date as string).localeCompare(b.expiry_date as string))
}

export function groupBySlot<T extends Pick<StockItem, 'slot_code'>>(items: T[]): { slot: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const i of items) map.set(i.slot_code, [...(map.get(i.slot_code) ?? []), i])
  return [...map.entries()].map(([slot, list]) => ({ slot, items: list })).sort((a, b) => a.slot.localeCompare(b.slot))
}

/** Today in India as YYYY-MM-DD (the database uses the same calendar via today_ist()). */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
