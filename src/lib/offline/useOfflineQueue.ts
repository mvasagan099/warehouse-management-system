import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { idbStore } from './idbStore'
import { isNetworkError, newItem, resolveItem, runQueue, type QueueItem, type QueueKind, type RunSummary } from './queue'
import { sendItem } from './senders'

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
let snapshot: QueueItem[] = []
let lastSummary: RunSummary | null = null

async function refresh() { snapshot = await idbStore.all().catch(() => []); notify() }
void refresh()

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const getSnapshot = () => snapshot
const onlineSub = (l: () => void) => { window.addEventListener('online', l); window.addEventListener('offline', l); return () => { window.removeEventListener('online', l); window.removeEventListener('offline', l) } }

/** Items waiting on this phone, sync state and the actions the UI needs. */
export function useOfflineQueue() {
  const { profile } = useAuth()
  const userId = profile?.id ?? ''
  const items = useSyncExternalStore(subscribe, getSnapshot).filter((i) => i.userId === userId)
  const online = useSyncExternalStore(onlineSub, () => navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const busy = useRef(false)

  const sync = useCallback(async () => {
    if (!userId || busy.current || !navigator.onLine) return null
    busy.current = true; setSyncing(true)
    try { lastSummary = await runQueue(idbStore, sendItem, userId); return lastSummary } finally { busy.current = false; setSyncing(false); await refresh() }
  }, [userId])

  useEffect(() => {
    if (online) void sync()
    const t = setInterval(() => { if (navigator.onLine) void sync() }, 30_000)
    return () => clearInterval(t)
  }, [online, sync])

  const enqueue = useCallback(async (kind: QueueKind, label: string, payload: Record<string, unknown>, extra?: Partial<QueueItem>) => {
    const item = newItem(kind, userId, label, payload, extra)
    await idbStore.put(item); await refresh()
    if (navigator.onLine) void sync()
    return item
  }, [userId, sync])

  const resolve = useCallback(async (id: string, choice: 'overwrite' | 'keep_server' | 'retry' | 'discard') => { await resolveItem(idbStore, sendItem, id, choice); await refresh() }, [])

  return { items, pending: items.filter((i) => i.status === 'PENDING').length, attention: items.filter((i) => i.status !== 'PENDING').length, online, syncing, sync, enqueue, resolve, lastSummary }
}

/** Runs `online` when connected; if the call fails for lack of a connection (or we are offline), keeps the entry in the queue instead. */
export { isNetworkError }
