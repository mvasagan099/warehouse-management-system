import { z } from 'zod'
import { optionalNumber, optionalText, positiveInt } from '../../lib/zod'
import { Constants, type StorageType } from '../../lib/types'

/** Storage types that need a temperature (set-point or band). Mirrors the database check. */
export const NEEDS_TEMPERATURE: readonly StorageType[] = ['CHILLED', 'FROZEN', 'DEEP_FREEZE']

export const bookingSchema = z
  .object({
    client_id: z.string().min(1, 'validation.required'),
    warehouse_id: z.string().min(1, 'validation.required'),
    storage_type: z.enum(Constants.public.Enums.storage_type),
    temp_setpoint_c: optionalNumber,
    temp_min: optionalNumber,
    temp_max: optionalNumber,
    brigade_type_id: z.string().transform((v) => (v === '' ? null : v)),
    brigades_requested: positiveInt,
    from_date: z.string().min(1, 'validation.required'),
    expected_days: positiveInt,
    remarks: optionalText(500),
  })
  .superRefine((v, ctx) => {
    const hasBand = v.temp_min !== null || v.temp_max !== null
    if (v.storage_type === 'DRY') {
      if (v.temp_setpoint_c !== null || hasBand) ctx.addIssue({ code: 'custom', path: ['temp_setpoint_c'], message: 'validation.tempNotAllowed' })
      return
    }
    if (hasBand && (v.temp_min === null || v.temp_max === null)) {
      ctx.addIssue({ code: 'custom', path: [v.temp_min === null ? 'temp_min' : 'temp_max'], message: 'validation.tempBoth' })
    }
    if (v.temp_min !== null && v.temp_max !== null && v.temp_min > v.temp_max) {
      ctx.addIssue({ code: 'custom', path: ['temp_min'], message: 'validation.tempOrder' })
    }
    if (NEEDS_TEMPERATURE.includes(v.storage_type) && v.temp_setpoint_c === null && !hasBand) {
      ctx.addIssue({ code: 'custom', path: ['temp_setpoint_c'], message: 'validation.tempRequired' })
    }
  })

export type BookingFormInput = z.input<typeof bookingSchema>
export type BookingFormOutput = z.output<typeof bookingSchema>

export const emptyBooking = (clientId = '', warehouseId = ''): BookingFormInput => ({
  client_id: clientId, warehouse_id: warehouseId, storage_type: 'FROZEN', temp_setpoint_c: '', temp_min: '', temp_max: '',
  brigade_type_id: '', brigades_requested: '10', from_date: new Date().toISOString().slice(0, 10), expected_days: '30', remarks: '',
})
