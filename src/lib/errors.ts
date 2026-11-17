import { FunctionsHttpError } from '@supabase/supabase-js'

/** Turn Supabase/PostgREST/Edge errors into a readable message. */
export async function errorMessage(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json()
      if (body?.error) return String(body.error)
    } catch {
      /* fall through */
    }
  }
  if (err && typeof err === 'object') {
    const e = err as { code?: string; message?: string }
    if (e.code === '42501') return 'You do not have permission to do this.'
    if (e.code === '23505') return 'A record with the same value already exists.'
    if (e.code === '23514') return 'The values break a validation rule. Please check the form.'
    if (e.message) return e.message
  }
  return 'Something went wrong. Please try again.'
}
