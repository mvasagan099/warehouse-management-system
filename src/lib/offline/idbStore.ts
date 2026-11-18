import type { QueueItem, QueueStore } from './queue'

const DB = 'wms-offline'
const STORE = 'queue'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); resolve(r.result) }
    t.onerror = () => { db.close(); reject(t.error) }
    t.onabort = () => { db.close(); reject(t.error) }
  }))
}

/** The real store: IndexedDB survives a closed tab and a restarted phone. */
export const idbStore: QueueStore = {
  all: () => tx('readonly', (s) => s.getAll() as IDBRequest<QueueItem[]>),
  put: async (item) => { await tx('readwrite', (s) => s.put(item)) },
  remove: async (id) => { await tx('readwrite', (s) => s.delete(id)) },
}
