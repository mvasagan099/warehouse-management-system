import { z } from 'zod'
import { positiveInt } from '../../lib/zod'

/** Mirrors the safety cap inside public.create_brigade_slots(). */
export const MAX_SLOTS_PER_REQUEST = 20000

export const slotBuilderSchema = z
  .object({
    warehouse_id: z.string().min(1, 'validation.required'),
    zone_id: z.string().min(1, 'validation.required'),
    brigade_type_id: z.string().min(1, 'validation.required'),
    aisles: positiveInt,
    racks: positiveInt,
    levels: positiveInt,
    slots_per_level: positiveInt,
    aisle_start: positiveInt,
  })
  .refine((v) => v.aisles * v.racks * v.levels * v.slots_per_level <= MAX_SLOTS_PER_REQUEST, {
    path: ['aisles'],
    message: 'validation.tooManySlots',
  })

export type SlotBuilderInput = z.input<typeof slotBuilderSchema>
export type SlotBuilderOutput = z.output<typeof slotBuilderSchema>

/** Same format the database function produces: W1-Z2-A3-R4-L2-B07 */
export function slotCode(warehouseCode: string, zoneCode: string, aisle: number, rack: number, level: number, position: number) {
  return `${warehouseCode}-${zoneCode}-A${aisle}-R${rack}-L${level}-B${String(position).padStart(2, '0')}`
}

export function slotPreview(
  v: { aisles: number; racks: number; levels: number; slots_per_level: number; aisle_start: number },
  warehouseCode: string,
  zoneCode: string,
) {
  const count = v.aisles * v.racks * v.levels * v.slots_per_level
  return {
    count,
    first: slotCode(warehouseCode, zoneCode, v.aisle_start, 1, 1, 1),
    last: slotCode(warehouseCode, zoneCode, v.aisle_start + v.aisles - 1, v.racks, v.levels, v.slots_per_level),
  }
}
