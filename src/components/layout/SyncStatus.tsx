import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue'
import type { QueueItem } from '../../lib/offline/queue'

/** The phone's own "sync status": offline badge, how many entries are waiting, and a list where a conflict is settled by the person (never overwritten silently). */
export function SyncStatus() {
  const { t, i18n } = useTranslation()
  const q = useOfflineQueue()
  const [open, setOpen] = useState(false)
  const total = q.items.length
  if (q.online && total === 0) return null
  const tone = q.attention > 0 ? 'bg-red-100 text-red-800' : !q.online ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-800'
  const label = !q.online ? t('offline.offline', { count: total }) : q.syncing ? t('offline.syncing') : q.attention > 0 ? t('offline.needsYou', { count: q.attention }) : t('offline.waitingCount', { count: total })
  return (
    <>
      <button onClick={() => setOpen(true)} className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${tone}`} data-testid="sync-status" aria-label={t('offline.statusLabel')}>
        {!q.online ? <CloudOff className="h-4 w-4" /> : q.attention > 0 ? <TriangleAlert className="h-4 w-4" /> : <RefreshCw className={`h-4 w-4 ${q.syncing ? 'animate-spin' : ''}`} />}{label}
      </button>
      {open && (
        <Modal open title={t('offline.title')} onClose={() => setOpen(false)} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.close')}</Button><Button disabled={!q.online || q.syncing} loading={q.syncing} onClick={() => void q.sync()}>{t('offline.syncNow')}</Button></>}>
          <p className="mb-3 text-sm text-slate-600">{t('offline.explain')}</p>
          <ul className="space-y-3 text-sm" data-testid="queue-list">
            {q.items.length === 0 && <li className="text-slate-500">{t('offline.empty')}</li>}
            {q.items.map((i) => <Row key={i.id} item={i} lang={i18n.resolvedLanguage ?? 'en'} onResolve={q.resolve} />)}
          </ul>
        </Modal>)}
    </>
  )
}

function Row({ item, onResolve, lang }: { item: QueueItem; lang: string; onResolve: (id: string, c: 'overwrite' | 'keep_server' | 'retry' | 'discard') => Promise<void> }) {
  const { t } = useTranslation()
  const when = new Date(item.createdAt).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN', { timeZone: 'Asia/Kolkata' })
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{t(`offline.kind.${item.kind}`)} · {item.label}</span><span className="text-xs text-slate-500">{when}</span></div>
      {item.status === 'PENDING' && <div className="mt-1 text-xs text-amber-700">{t('offline.waiting')}</div>}
      {item.status === 'CONFLICT' && (
        <div className="mt-2 space-y-2 rounded bg-red-50 p-2 text-red-900"><p>{t('offline.conflict', { value: JSON.stringify(item.serverValue ?? {}) })}</p><p className="text-xs">{t('offline.yours', { value: JSON.stringify(item.payload) })}</p>
          <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void onResolve(item.id, 'keep_server')}>{t('offline.keepServer')}</Button><Button size="sm" variant="danger" onClick={() => void onResolve(item.id, 'overwrite')}>{t('offline.useMine')}</Button></div></div>)}
      {item.status === 'FAILED' && (
        <div className="mt-2 space-y-2 rounded bg-red-50 p-2 text-red-900"><p>{t('offline.refused', { reason: item.error ?? '' })}</p>
          <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => void onResolve(item.id, 'retry')}>{t('offline.retry')}</Button><Button size="sm" variant="ghost" onClick={() => void onResolve(item.id, 'discard')}>{t('offline.discard')}</Button></div></div>)}
    </li>
  )
}
