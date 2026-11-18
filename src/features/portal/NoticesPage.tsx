import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, EmptyState, ErrorState, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'

/** The notifications centre: stock received, dispatches, invoices, payments, reminders, support replies and approved temperature notices. */
export function NoticesPage() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const list = useQuery({ queryKey: ['notices_all'], queryFn: async () => { const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200); if (error) throw error; return data } })
  const readAll = useMutation({ mutationFn: async () => { await supabase.rpc('mark_notifications_read', {}) }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['notices_all'] }); void qc.invalidateQueries({ queryKey: ['notifications'] }) } })
  const unread = (list.data ?? []).filter((n) => !n.read_at).length
  return (
    <div>
      <PageHeader title={t('notices.title')} subtitle={t('notices.subtitle')} actions={<Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} disabled={!unread} loading={readAll.isPending} onClick={() => readAll.mutate()}>{t('notices.markAll')}</Button>} />
      <Card>{list.isPending ? <div className="flex justify-center p-8"><Spinner /></div> : list.error ? <ErrorState message={t('common.error')} onRetry={() => list.refetch()} /> : !list.data?.length ? <EmptyState message={t('notices.none')} /> : (
        <ul className="divide-y divide-slate-100 text-sm">{list.data.map((n) => (
          <li key={n.id}><button className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => n.link && navigate(n.link)}>
            <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.read_at ? 'text-slate-300' : 'text-brand-700'}`} aria-hidden /><span className="flex-1"><span className={n.read_at ? '' : 'font-semibold'}>{n.title}</span>{n.body && <span className="block text-slate-600">{n.body}</span>}</span>
            <span className="shrink-0 text-xs text-slate-500">{formatDateTime(n.created_at, i18n.resolvedLanguage)}</span></button></li>))}</ul>)}</Card>
    </div>
  )
}
