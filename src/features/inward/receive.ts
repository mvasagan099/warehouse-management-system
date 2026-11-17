import type { GateEntryLine } from '../../lib/types'

type StockCondition = 'GOOD' | 'DAMAGED'

export interface LineCount { accepted: string; damaged: string; remarks: string }
export interface Placement { key: string; line_id: string; slot_id: string; quantity: string; condition: StockCondition }

const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : NaN }

/** Per line: declared, accepted, damaged, short = what never arrived. */
export function lineTotals(line: Pick<GateEntryLine, 'declared_qty'>, c: LineCount) {
  const accepted = num(c.accepted === '' ? '0' : c.accepted)
  const damaged = num(c.damaged === '' ? '0' : c.damaged)
  const declared = Number(line.declared_qty)
  return { declared, accepted, damaged, short: Math.max(declared - accepted - damaged, 0), valid: accepted >= 0 && damaged >= 0 && !Number.isNaN(accepted + damaged) }
}

/** Does what staff placed in slots equal what they counted? Returns problems per line. */
export function placementProblems(
  lines: Pick<GateEntryLine, 'id' | 'declared_qty'>[],
  counts: Record<string, LineCount>,
  placements: Placement[],
): Record<string, 'invalid' | 'good' | 'damaged' | 'noSlot' | null> {
  const out: Record<string, 'invalid' | 'good' | 'damaged' | 'noSlot' | null> = {}
  for (const l of lines) {
    const c = counts[l.id] ?? { accepted: '', damaged: '', remarks: '' }
    const t = lineTotals(l, c)
    const mine = placements.filter((p) => p.line_id === l.id)
    const good = mine.filter((p) => p.condition === 'GOOD').reduce((n, p) => n + num(p.quantity), 0)
    const bad = mine.filter((p) => p.condition === 'DAMAGED').reduce((n, p) => n + num(p.quantity), 0)
    const anyBlankSlot = mine.some((p) => !p.slot_id)
    out[l.id] = !t.valid ? 'invalid'
      : anyBlankSlot ? 'noSlot'
      : Math.abs(good - t.accepted) > 1e-6 ? 'good'
      : Math.abs(bad - t.damaged) > 1e-6 ? 'damaged'
      : null
  }
  return out
}
