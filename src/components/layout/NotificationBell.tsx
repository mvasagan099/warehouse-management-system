import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useColdChainRealtime, useNotifications } from '../../features/coldchain/queries'
import { formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'

/** In-app notifications (alerts, client notices, maintenance reminders); updates live. Billing-only roles never have any. */
export function NotificationBell() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const enabled = !!profile && profile.role !== 'ACCOUNTANT'
  const list = useNotifications()
  useColdChainRealtime(enabled)
  const [open, setOpen] = useState(false)
  const read = useMutation({ mutationFn: async () => { await supabase.rpc('mark_notifications_read', {}) }, onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }) })
  if (!enabled) return null
  const unread = (list.data ?? []).filter((n) => !n.read_at).length
  return (
    <div className="relative">
      <button className="relative rounded p-1.5 text-slate-600 hover:bg-slate-100" aria-label={t('cold.notifications')} aria-expanded={open} onClick={() => { setOpen(!open); if (!open && unread) read.mutate() }}>
        <Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white" data-testid="unread-count">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[85vw] rounded-xl border border-slate-200 bg-white shadow-lg" role="dialog" aria-label={t('cold.notifications')}>
          <div className="border-b border-slate-200 p-3 text-sm font-semibold">{t('cold.notifications')}</div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto text-sm">
            {(list.data ?? []).map((n) => (
              <li key={n.id}><button className="block w-full p-3 text-left hover:bg-slate-50" onClick={() => { setOpen(false); navigate(n.task_id ? '/equipment' : profile?.role === 'CLIENT' ? '/cold-reports' : '/alerts') }}>
                <div className={n.read_at ? '' : 'font-medium'}>{n.title}</div><div className="text-xs text-slate-500">{formatDateTime(n.created_at, i18n.resolvedLanguage)}</div></button></li>))}
            {!list.data?.length && <li className="p-4 text-slate-500">{t('cold.noNotifications')}</li>}
          </ul>
        </div>)}
    </div>
  )
}
