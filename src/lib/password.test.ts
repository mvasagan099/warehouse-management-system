import { describe, expect, it } from 'vitest'
import { passwordProblem, strongPassword } from './password'

describe('password rules', () => {
  it('rejects short passwords', () => expect(passwordProblem('Abc12345')).toBe('validation.passwordMin'))
  it('needs lower, upper and a digit', () => {
    expect(passwordProblem('abcdefghij1')).toBe('validation.passwordStrong')
    expect(passwordProblem('ABCDEFGHIJ1')).toBe('validation.passwordStrong')
    expect(passwordProblem('Abcdefghijk')).toBe('validation.passwordStrong')
  })
  it('accepts a strong password', () => expect(passwordProblem('Kaveri-4821-Tq')).toBeNull())
  it('works as a zod type', () => {
    expect(strongPassword.safeParse('weak').success).toBe(false)
    expect(strongPassword.safeParse('Strong-Pass-1').success).toBe(true)
  })
})
