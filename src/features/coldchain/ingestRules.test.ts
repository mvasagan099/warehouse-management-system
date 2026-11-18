// Tests the pure rules behind ingest-reading and notify-alert (same file the Edge Functions import).
import { describe, expect, it } from 'vitest'
import { emailNotifier, extractKey, ingestErrorStatus, ingestStatus, outcome, parseIngestBody, resendBody, sha256Hex, stubNotifier } from '../../../supabase/functions/_shared/coldchain-rules.ts'

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null })

describe('ingest request parsing', () => {
  it('accepts a single reading, an array, or { readings }', () => {
    const one = parseIngestBody({ sensor: 'FRZ-01', value: -19.4, unit: 'C', timestamp: '2026-11-18T09:30:00+05:30' })
    expect(one.ok && one.readings).toEqual([{ sensor: 'FRZ-01', value: -19.4, unit: 'C', timestamp: '2026-11-18T04:00:00.000Z' }])
    expect(parseIngestBody([{ sensor: 'A', value: 1 }, { sensor: 'B', value: 0 }]).ok).toBe(true)
    expect(parseIngestBody({ readings: [{ sensor: 'A', value: 1 }] }).ok).toBe(true)
  })
  it('rejects bad shapes', () => {
    for (const bad of [null, 'x', 5, [], { readings: [] }, { sensor: 'A' }, { sensor: 'A', value: '5' }, { sensor: 'A', value: NaN }, { sensor: '', value: 1 }, { sensor: 'A', value: 1, timestamp: 'yesterday' },
      { sensor: 'A', value: 1, battery: 101 }, { sensor: 'A', value: 1, battery: 5.5 }, [1], { sensor: 'A', value: 1, unit: 'degrees celsius' }])
      expect(parseIngestBody(bad).ok).toBe(false)
  })
  it('limits a batch to 100 readings', () => {
    const many = (n: number) => Array.from({ length: n }, () => ({ sensor: 'A', value: 1 }))
    expect(parseIngestBody(many(100)).ok).toBe(true)
    expect(parseIngestBody(many(101)).ok).toBe(false)
  })
  it('reads the device key from the header, a bearer token or the body', () => {
    expect(extractKey(headers({ 'x-device-key': ' wms_abc ' }), {})).toBe('wms_abc')
    expect(extractKey(headers({ authorization: 'Bearer wms_def' }), {})).toBe('wms_def')
    expect(extractKey(headers({ authorization: 'Bearer eyJhbGciOi' }), {})).toBeNull()      // a user JWT is not a device key
    expect(extractKey(headers({}), { key: 'wms_ghi' })).toBe('wms_ghi')
    expect(extractKey(headers({}), {})).toBeNull()
  })
  it('hashes the key with SHA-256 (hex)', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('maps results and database errors to HTTP statuses', () => {
    expect(ingestStatus({ accepted: 1, duplicates: 0, rejected: [{}] })).toBe(200)
    expect(ingestStatus({ accepted: 0, duplicates: 1, rejected: [] })).toBe(200)
    expect(ingestStatus({ accepted: 0, duplicates: 0, rejected: [{}] })).toBe(422)
    expect(ingestErrorStatus('WMS40')).toBe(401)
    expect(ingestErrorStatus('WMS41')).toBe(400)
    expect(ingestErrorStatus('XX000')).toBe(500)
  })
})

describe('notification providers', () => {
  it('builds the Resend request', () => {
    expect(resendBody('a@b.in', { to: 'c@d.in', subject: 'S', body: 'B' })).toEqual({ from: 'a@b.in', to: ['c@d.in'], subject: 'S', text: 'B' })
  })
  it('the email notifier reports success and failure', async () => {
    const ok = emailNotifier('k', 'a@b.in', (async () => new Response('{}', { status: 200 })) as typeof fetch)
    expect(await ok.send({ to: 'c@d.in', subject: null, body: 'x' })).toEqual({ ok: true })
    const bad = emailNotifier('k', 'a@b.in', (async () => new Response('no', { status: 422 })) as typeof fetch)
    expect(await bad.send({ to: 'c@d.in', subject: null, body: 'x' })).toMatchObject({ ok: false })
  })
  it('WhatsApp and SMS are a stub that never pretends to send', async () => {
    for (const ch of ['WHATSAPP', 'SMS'] as const) {
      const r = await stubNotifier(ch).send({ to: '+919800000000', subject: null, body: 'x' })
      expect(r).toMatchObject({ ok: false, skipped: true })
      expect(outcome(r).status).toBe('SKIPPED')
    }
    expect(outcome({ ok: true })).toEqual({ status: 'SENT', error: null })
    expect(outcome({ ok: false, error: 'boom' })).toEqual({ status: 'FAILED', error: 'boom' })
  })
})
