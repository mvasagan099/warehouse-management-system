import type { StorageType, ZoneSlotSummary } from '../../lib/types'

export interface Totals {
  zones: number
  total: number
  free: number
  occupied: number
  blocked: number
}

export function totals(rows: ZoneSlotSummary[]): Totals {
  return rows.reduce<Totals>(
    (acc, r) => ({
      zones: acc.zones + 1,
      total: acc.total + (r.total_slots ?? 0),
      free: acc.free + (r.free_slots ?? 0),
      occupied: acc.occupied + (r.occupied_slots ?? 0),
      blocked: acc.blocked + (r.blocked_slots ?? 0),
    }),
    { zones: 0, total: 0, free: 0, occupied: 0, blocked: 0 },
  )
}

export interface StorageTypeRow extends Totals {
  storage_type: StorageType
}

/** Aggregate the per-zone view rows by storage type (keeps enum order stable). */
export function byStorageType(rows: ZoneSlotSummary[], order: readonly StorageType[]): StorageTypeRow[] {
  return order
    .map((st) => ({ storage_type: st, ...totals(rows.filter((r) => r.storage_type === st)) }))
    .filter((r) => r.zones > 0)
}
