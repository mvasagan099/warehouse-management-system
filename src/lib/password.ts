import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 10

/** At least 10 characters with a lower-case letter, an upper-case letter and a digit (the same rule as the create-user Edge Function and the Auth settings). */
export function passwordProblem(p: string): 'validation.passwordMin' | 'validation.passwordStrong' | null {
  if (p.length < MIN_PASSWORD_LENGTH) return 'validation.passwordMin'
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) return 'validation.passwordStrong'
  return null
}

export const strongPassword = z.string().superRefine((v, ctx) => {
  const problem = passwordProblem(v)
  if (problem) ctx.addIssue({ code: 'custom', message: problem })
})
