import { z } from 'zod'
import { optionalText, positiveNumber, requiredText } from '../../lib/zod'
import type { BrigadeType } from '../../lib/types'

export const brigadeTypeSchema = z.object({
  name: requiredText(100),
  description: optionalText(300),
  length_m: positiveNumber,
  width_m: positiveNumber,
  height_m: positiveNumber,
  max_weight_kg: positiveNumber,
})
export type BrigadeTypeInput = z.input<typeof brigadeTypeSchema>
export type BrigadeTypeOutput = z.output<typeof brigadeTypeSchema>

export const emptyBrigadeType: BrigadeTypeInput = {
  name: '', description: '', length_m: '', width_m: '', height_m: '', max_weight_kg: '',
}

export function brigadeTypeToForm(b: BrigadeType): BrigadeTypeInput {
  return {
    name: b.name,
    description: b.description ?? '',
    length_m: String(b.length_m),
    width_m: String(b.width_m),
    height_m: String(b.height_m),
    max_weight_kg: String(b.max_weight_kg),
  }
}

/** Preview of the generated volume column (the database is the source of truth). */
export function previewVolume(l: string, w: string, h: string): number | null {
  const [a, b, c] = [Number(l), Number(w), Number(h)]
  if (![a, b, c].every((n) => Number.isFinite(n) && n > 0)) return null
  return Math.round(a * b * c * 1000) / 1000
}
