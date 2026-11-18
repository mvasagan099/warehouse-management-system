// Deno-side helpers: Sentry reporting and rate limiting for Edge Functions.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { parseDsn, sentryEnvelope } from './ops-rules.ts'

/** Sends an error to Sentry when SENTRY_DSN is set. Never throws. */
export async function reportError(fn: string, err: unknown): Promise<void> {
  try {
    const dsn = parseDsn(Deno.env.get('SENTRY_DSN'))
    if (!dsn) return
    await fetch(`https://${dsn.host}/api/${dsn.projectId}/envelope/`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}` }, body: sentryEnvelope(dsn, fn, err),
    })
  } catch { /* reporting must never break the request */ }
}

/** Wraps a handler: unexpected errors are reported to Sentry and answered with a plain 500. */
export function guarded(fn: string, handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try { return await handler(req) } catch (e) {
      await reportError(fn, e)
      return new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
  }
}

/** true when the call is allowed. Fails open if the limiter itself is down, so a database hiccup never stops the warehouse. */
export async function allowed(admin: SupabaseClient, key: string, windowSeconds: number, max: number): Promise<boolean> {
  const { data, error } = await admin.rpc('rate_limit_hit', { p_key: key, p_window_seconds: windowSeconds, p_max: max })
  return error ? true : data === true
}
