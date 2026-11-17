import { z } from 'zod'

// Validation messages are i18n keys; <Field> translates them.
export const requiredText = (max = 200) =>
  z.string().trim().min(1, 'validation.required').max(max, 'validation.tooLong')

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, 'validation.tooLong')
    .transform((v) => (v === '' ? null : v))

/** Form inputs keep numbers as strings; this converts '' -> null and validates. */
export const optionalNumber = z
  .string()
  .trim()
  .refine((v) => v === '' || Number.isFinite(Number(v)), 'validation.number')
  .transform((v) => (v === '' ? null : Number(v)))

export const requiredNumber = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine((v) => Number.isFinite(Number(v)), 'validation.number')
  .transform((v) => Number(v))

export const positiveNumber = requiredNumber.refine((v) => v > 0, 'validation.positive')

export const positiveInt = requiredNumber.refine((v) => Number.isInteger(v) && v >= 1, 'validation.positiveInt')

export const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === '' || z.email().safeParse(v).success, 'validation.email')
  .transform((v) => (v === '' ? null : v.toLowerCase()))

export const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\+?[0-9\s-]{8,15}$/.test(v), 'validation.phone')
  .transform((v) => (v === '' ? null : v))
