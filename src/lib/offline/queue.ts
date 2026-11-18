// Offline queue core: pure logic, storage and network are injected so Vitest can run it without a browser.
// Rules: items are sent oldest first; a lost connection stops the run and keeps everything; nothing is ever silently overwritten:
// if the server changed since the user saw a record, the item becomes a CONFLICT and the user decides.

export type QueueKind = 'gate_entry' | 'count' | 'manual_reading' | 'scan' | 'attendance'
export type QueueStatus = 'PENDING' | 'CONFLICT' | 'FAILED'

export interface QueueItem {
  id: string                 // also the idempotency key (becomes the row id for inserts)
  kind: QueueKind
  userId: string
  label: string              // short text shown in the sync list
  payload: Record<string, unknown>
  createdAt: string
  status: QueueStatus
  attempts: number
  error?: string
  /** For updates: the updated_at the user saw. If the server row changed since, we ask instead of overwriting. */
  baseUpdatedAt?: string | null
  /** What the server holds now, filled in when a conflict is detected (shown to the user). */
  serverValue?: Record<string, unknown> | null
}

export interface QueueStore {
  all(): Promise<QueueItem[]>
  put(item: QueueItem): Promise<void>
  remove(id: string): Promise<void>
}

export type SendResult =
  | { type: 'ok' }
  | { type: 'duplicate' }                                           // the same item was already saved earlier (safe to drop)
  | { type: 'conflict'; serverValue: Record<string, unknown> | null }
  | { type: 'rejected'; message: string }                           // the server said no (business rule): the user must fix or discard
  | { type: 'offline' }                                             // no connection: stop and retry later

export type Sender = (item: QueueItem, opts: { overwrite: boolean }) => Promise<SendResult>

export function newItem(kind: QueueKind, userId: string, label: string, payload: Record<string, unknown>, extra: Partial<QueueItem> = {}): QueueItem {
  return { id: crypto.randomUUID(), kind, userId, label, payload, createdAt: new Date().toISOString(), status: 'PENDING', attempts: 0, ...extra }
}

export interface RunSummary { sent: number; duplicates: number; conflicts: number; rejected: number; stoppedOffline: boolean }

/** Sends every PENDING item for this user, oldest first. Items in CONFLICT or FAILED wait for the user. */
export async function runQueue(store: QueueStore, send: Sender, userId: string): Promise<RunSummary> {
  const s: RunSummary = { sent: 0, duplicates: 0, conflicts: 0, rejected: 0, stoppedOffline: false }
  const items = (await store.all()).filter((i) => i.userId === userId && i.status === 'PENDING').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const item of items) {
    const r = await send(item, { overwrite: false })
    if (r.type === 'offline') { s.stoppedOffline = true; break }
    if (r.type === 'ok') { await store.remove(item.id); s.sent++ }
    else if (r.type === 'duplicate') { await store.remove(item.id); s.duplicates++ }
    else if (r.type === 'conflict') { await store.put({ ...item, status: 'CONFLICT', attempts: item.attempts + 1, serverValue: r.serverValue, error: undefined }); s.conflicts++ }
    else { await store.put({ ...item, status: 'FAILED', attempts: item.attempts + 1, error: r.message }); s.rejected++ }
  }
  return s
}

/** The user chose what to do with a CONFLICT / FAILED item. */
export async function resolveItem(store: QueueStore, send: Sender, id: string, choice: 'overwrite' | 'keep_server' | 'retry' | 'discard'): Promise<SendResult | null> {
  const item = (await store.all()).find((i) => i.id === id)
  if (!item) return null
  if (choice === 'discard' || choice === 'keep_server') { await store.remove(id); return { type: 'ok' } }
  const r = await send(item, { overwrite: choice === 'overwrite' })
  if (r.type === 'ok' || r.type === 'duplicate') await store.remove(id)
  else if (r.type === 'rejected') await store.put({ ...item, status: 'FAILED', error: r.message, attempts: item.attempts + 1 })
  else if (r.type === 'conflict') await store.put({ ...item, status: 'CONFLICT', serverValue: r.serverValue, attempts: item.attempts + 1 })
  return r
}

export function memoryStore(): QueueStore & { items: Map<string, QueueItem> } {
  const items = new Map<string, QueueItem>()
  return { items, all: async () => [...items.values()], put: async (i) => { items.set(i.id, i) }, remove: async (id) => { items.delete(id) } }
}

/** True for errors that mean "no usable connection" rather than "the server refused". */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const m = err && typeof err === 'object' ? String((err as { message?: string }).message ?? '') : String(err ?? '')
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|ECONN|ENOTFOUND/i.test(m)
}
