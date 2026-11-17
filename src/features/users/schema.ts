import { z } from 'zod'
import { optionalPhone, requiredText } from '../../lib/zod'

export const createUserSchema = z
  .object({
    full_name: requiredText(150),
    email: z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email')).transform((v) => v.toLowerCase()),
    phone: optionalPhone,
    role: z.enum(['WAREHOUSE_MANAGER', 'STAFF', 'ACCOUNTANT']),
    password: z.string().min(8, 'validation.passwordMin'),
    warehouse_ids: z.array(z.string()),
  })
  .refine((v) => v.role === 'ACCOUNTANT' || v.warehouse_ids.length >= 1, {
    path: ['warehouse_ids'],
    message: 'validation.warehouseRequired',
  })
  .refine((v) => v.role !== 'STAFF' || v.warehouse_ids.length === 1, {
    path: ['warehouse_ids'],
    message: 'validation.oneWarehouse',
  })

export type CreateUserInput = z.input<typeof createUserSchema>
export type CreateUserOutput = z.output<typeof createUserSchema>

/** Readable temporary password, e.g. "Kaveri-4821-Tq" (no ambiguous characters). */
const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

export function generateTempPassword(random: () => number = cryptoRandom): string {
  const words = ['Kaveri', 'Vaigai', 'Palar', 'Noyyal', 'Bhavani', 'Amaravathi', 'Tamirabarani', 'Kollidam']
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const word = words[Math.floor(random() * words.length)]
  const digits = String(Math.floor(random() * 9000) + 1000)
  const tail = letters[Math.floor(random() * letters.length)] + letters[Math.floor(random() * letters.length)]
  return `${word}-${digits}-${tail}`
}
