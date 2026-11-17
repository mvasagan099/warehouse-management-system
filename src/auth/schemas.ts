import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email')),
  password: z.string().min(1, 'validation.required'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const forgotSchema = z.object({
  email: z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email')),
})

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'validation.passwordMin'),
    confirm: z.string().min(1, 'validation.required'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'validation.passwordMatch' })

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'validation.required'),
    password: z.string().min(8, 'validation.passwordMin'),
    confirm: z.string().min(1, 'validation.required'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'validation.passwordMatch' })
