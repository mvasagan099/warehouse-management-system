import { describe, expect, it, vi } from 'vitest'
import { memoryStore, newItem, resolveItem, runQueue, type Sender } from './queue'

const U = 'user-1'
const mk = (label: string, at: string, extra = {}) => ({ ...newItem('gate_entry', U, label, { n: label }, extra), createdAt: at })

describe('offline queue', () => {
  it('sends items oldest first and removes them', async () => {
    const store = memoryStore()
    await store.put(mk('b', '2026-01-01T10:02:00Z')); await store.put(mk('a', '2026-01-01T10:01:00Z'))
    const order: string[] = []
    const send: Sender = async (i) => { order.push(i.label); return { type: 'ok' } }
    const s = await runQueue(store, send, U)
    expect(order).toEqual(['a', 'b']); expect(s.sent).toBe(2); expect(store.items.size).toBe(0)
  })
  it('stops at the first lost connection and keeps everything left', async () => {
    const store = memoryStore()
    await store.put(mk('a', '2026-01-01T10:01:00Z')); await store.put(mk('b', '2026-01-01T10:02:00Z')); await store.put(mk('c', '2026-01-01T10:03:00Z'))
    const send: Sender = vi.fn(async (i) => (i.label === 'b' ? { type: 'offline' as const } : { type: 'ok' as const }))
    const s = await runQueue(store, send, U)
    expect(s.stoppedOffline).toBe(true); expect([...store.items.values()].map((i) => i.label).sort()).toEqual(['b', 'c'])
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('treats an already-saved item as done (no second lorry)', async () => {
    const store = memoryStore(); await store.put(mk('a', '2026-01-01T10:01:00Z'))
    const s = await runQueue(store, async () => ({ type: 'duplicate' }), U)
    expect(s.duplicates).toBe(1); expect(store.items.size).toBe(0)
  })
  it('never overwrites silently: a changed server row becomes a conflict the user must settle', async () => {
    const store = memoryStore(); const item = mk('count', '2026-01-01T10:01:00Z', { baseUpdatedAt: 't0' }); await store.put(item)
    const send: Sender = async (_i, o) => (o.overwrite ? { type: 'ok' } : { type: 'conflict', serverValue: { counted_qty: 7 } })
    const s = await runQueue(store, send, U)
    expect(s.conflicts).toBe(1)
    const held = store.items.get(item.id)!
    expect(held.status).toBe('CONFLICT'); expect(held.serverValue).toEqual({ counted_qty: 7 })
    // a second run does not touch it
    expect((await runQueue(store, send, U)).sent).toBe(0)
    await resolveItem(store, send, item.id, 'overwrite')
    expect(store.items.size).toBe(0)
  })
  it('keep_server and discard drop the local copy without sending', async () => {
    const store = memoryStore(); const item = mk('x', '2026-01-01T10:01:00Z'); await store.put({ ...item, status: 'CONFLICT' })
    const send = vi.fn<Sender>()
    await resolveItem(store, send, item.id, 'keep_server')
    expect(send).not.toHaveBeenCalled(); expect(store.items.size).toBe(0)
  })
  it('a refused entry is kept as FAILED with the reason', async () => {
    const store = memoryStore(); const item = mk('x', '2026-01-01T10:01:00Z'); await store.put(item)
    await runQueue(store, async () => ({ type: 'rejected', message: 'Lorry already at the gate' }), U)
    expect(store.items.get(item.id)).toMatchObject({ status: 'FAILED', error: 'Lorry already at the gate' })
  })
  it('only handles the signed-in user\'s items', async () => {
    const store = memoryStore(); await store.put({ ...mk('mine', '2026-01-01T10:01:00Z') }); await store.put({ ...mk('theirs', '2026-01-01T10:02:00Z'), userId: 'other' })
    const send = vi.fn<Sender>(async () => ({ type: 'ok' }))
    await runQueue(store, send, U)
    expect(send).toHaveBeenCalledTimes(1); expect(store.items.size).toBe(1)
  })
})
