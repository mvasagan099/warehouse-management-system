import { z } from 'zod'
import { optionalNumber, optionalText, requiredText } from '../../lib/zod'
import { Constants, type StorageType, type Zone } from '../../lib/types'

/** Storage types that must have a temperature band. Mirrors the DB check constraint. */
export const TEMPERATURE_REQUIRED: readonly StorageType[] = ['CHILLED', 'FROZEN', 'DEEP_FREEZE']
export const TEMPERATURE_FORBIDDEN: readonly StorageType[] = ['DRY']

export const zoneSchema = z
  .object({
    warehouse_id: z.string().min(1, 'validation.required'),
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => v === '' || /^[A-Z0-9]{1,10}$/.test(v), 'validation.code'),
    name: requiredText(100),
    storage_type: z.enum(Constants.public.Enums.storage_type),
    temp_min: optionalNumber,
    temp_max: optionalNumber,
    notes: optionalText(300),
  })
  .superRefine((v, ctx) => {
    const hasMin = v.temp_min !== null
    const hasMax = v.temp_max !== null
    if (TEMPERATURE_FORBIDDEN.includes(v.storage_type)) {
      if (hasMin) ctx.addIssue({ code: 'custom', path: ['temp_min'], message: 'validation.tempNotAllowed' })
      if (hasMax) ctx.addIssue({ code: 'custom', path: ['temp_max'], message: 'validation.tempNotAllowed' })
      return
    }
    if (TEMPERATURE_REQUIRED.includes(v.storage_type)) {
      if (!hasMin) ctx.addIssue({ code: 'custom', path: ['temp_min'], message: 'validation.tempRequired' })
      if (!hasMax) ctx.addIssue({ code: 'custom', path: ['temp_max'], message: 'validation.tempRequired' })
    } else if (hasMin !== hasMax) {
      ctx.addIssue({ code: 'custom', path: [hasMin ? 'temp_max' : 'temp_min'], message: 'validation.tempBoth' })
    }
    if (hasMin && hasMax && (v.temp_min as number) > (v.temp_max as number)) {
      ctx.addIssue({ code: 'custom', path: ['temp_min'], message: 'validation.tempOrder' })
    }
  })

export type ZoneFormInput = z.input<typeof zoneSchema>
export type ZoneFormOutput = z.output<typeof zoneSchema>

export function emptyZone(warehouseId = ''): ZoneFormInput {
  return { warehouse_id: warehouseId, code: '', name: '', storage_type: 'DRY', temp_min: '', temp_max: '', notes: '' }
}

export function zoneToForm(z: Zone): ZoneFormInput {
  return {
    warehouse_id: z.warehouse_id,
    code: z.code,
    name: z.name,
    storage_type: z.storage_type,
    temp_min: z.temp_min === null ? '' : String(z.temp_min),
    temp_max: z.temp_max === null ? '' : String(z.temp_max),
    notes: z.notes ?? '',
  }
}
