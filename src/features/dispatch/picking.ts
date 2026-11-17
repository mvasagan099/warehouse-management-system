import { parseScan } from '../../lib/scan'
import type { DispatchPick } from '../../lib/types'

type PickLike = Pick<DispatchPick, 'id' | 'stock_item_id' | 'slot_id' | 'batch_no' | 'picked'>

/**
 * Which open pick does a scanned code belong to? Returns null when it matches nothing, so the
 * caller sends it to the server anyway and shows the server's "wrong batch" message
 * (the database is what actually blocks the wrong batch; this only chooses the pick).
 */
export function matchPick(picks: PickLike[], code: string): PickLike | null {
  const open = picks.filter((p) => !p.picked)
  const target = parseScan(code)
  if (target.kind === 'stock') return open.find((p) => p.stock_item_id === target.id) ?? null
  if (target.kind === 'slot') return open.find((p) => p.slot_id === target.id) ?? null
  const text = target.text.toUpperCase()
  return open.find((p) => p.batch_no && p.batch_no.toUpperCase() === text) ?? null
}

export const allPicked = (picks: Pick<DispatchPick, 'picked'>[]) => picks.length > 0 && picks.every((p) => p.picked)
