import { describe, expect, it } from 'vitest'
import type { ZoneSlotSummary } from '../../lib/types'
import { Constants } from '../../lib/types'
import { byStorageType, totals } from './summary'

const row = (o: Partial<ZoneSlotSummary>): ZoneSlotSummary => ({
  warehouse_id: 'w', warehouse_code: 'W1', warehouse_name: 'W', zone_id: 'z', zone_code: 'Z1', zone_name: 'Z',
  storage_type: 'DRY', temp_min: null, temp_max: null, total_slots: 0, free_slots: 0, occupied_slots: 0, blocked_slots: 0, ...o,
})

describe('dashboard summary', () => {
  const rows = [
    row({ storage_type: 'DRY', total_slots: 60, free_slots: 50, occupied_slots: 10 }),
    row({ storage_type: 'FROZEN', total_slots: 40, free_slots: 35, blocked_slots: 5 }),
    row({ storage_type: 'FROZEN', total_slots: 10, free_slots: 10 }),
  ]
  it('totals free vs occupied', () => {
    expect(totals(rows)).toEqual({ zones: 3, total: 110, free: 95, occupied: 10, blocked: 5 })
  })
  it('groups by storage type in enum order, skipping unused types', () => {
    const r = byStorageType(rows, Constants.public.Enums.storage_type)
    expect(r.map((x) => [x.storage_type, x.zones, x.total])).toEqual([['DRY', 1, 60], ['FROZEN', 2, 50]])
  })
})
