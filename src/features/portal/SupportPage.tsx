import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { openPrivateFile, safeFileName } from '../../lib/download'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type SupportTicket, type TicketEvent, type TicketStatus } from '../../lib/types'
import { useWarehouses } from '../shared/queries'

const TONE: Record<TicketStatus, 'blue' | 'amber' | 'violet' | 'green' | 'gray'> = { OPEN: 'blue', IN_PROGRESS: 'amber', WAITING_CLIENT: 'violet', RESOLVED: 'green', CLOSED: 'gray' }

async function uploadAll(clientId: string, files: File[]): Promise<string[]> {
  const out: string[] = []
  for (const f of files) {
    const path = `${clientId}/${crypto.randomUUID()}/${safeFileName(f.name)}`
    const up = await supabase.storage.from('tickets').upload(path, f, { contentType: f.type }); if (up.error) throw up.error
    out.push(path)
  }
  return out
}

function Attachments({ paths }: { paths: string[] }) {
  const { t } = useTranslation()
  if (!paths.length) return null
  return <div className="mt-1 flex flex-wrap gap-2">{paths.map((p) => <button key={p} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs hover:bg-slate-200" onClick={() => openPrivateFile('tickets', p).catch(async (e) => toast.error(await errorMessage(e)))}><Paperclip className="h-3 w-3" />{p.split('/').pop()}<span className="sr-only"> {t('support.attachment')}</span></button>)}</div>
}

function NewTicket({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const whs = useWarehouses()
  const [f, setF] = useState({ subject: '', body: '', warehouse: '' })
  const [files, setFiles] = useState<File[]>([])
  const save = useMutation({
    mutationFn: async () => {
      const paths = profile?.client_id ? await uploadAll(profile.client_id, files) : []
      const { error } = await supabase.rpc('open_ticket', { p_subject: f.subject, p_body: f.body, p_warehouse_id: f.warehouse || undefined, p_attachments: paths })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('support.sent')); void qc.invalidateQueries({ queryKey: ['tickets'] }); onClose() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('support.new')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} disabled={f.subject.trim().length < 3 || f.body.trim().length < 2} onClick={() => save.mutate()}>{t('support.send')}</Button></>}>
      <div className="grid gap-3 text-sm">
        <Field label={t('support.subject')} htmlFor="tk-sub"><Input id="tk-sub" maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label={t('common.warehouse')} htmlFor="tk-wh" optional><Select id="tk-wh" value={f.warehouse} onChange={(e) => setF({ ...f, warehouse: e.target.value })}><option value="">—</option>{(whs.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
        <Field label={t('support.message')} htmlFor="tk-body"><Textarea id="tk-body" rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label={t('support.attach')} htmlFor="tk-files" optional hint={t('support.attachHint')}><input id="tk-files" type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))} className="block w-full text-sm" /></Field>
      </div>
    </Modal>
  )
}

function TicketDetail({ ticket, isClient, onClose }: { ticket: SupportTicket; isClient: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const events = useQuery({ queryKey: ['ticket_events', ticket.id], queryFn: async () => { const { data, error } = await supabase.from('ticket_events').select('*').eq('ticket_id', ticket.id).order('created_at'); if (error) throw error; return data as TicketEvent[] } })
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const refresh = () => { void events.refetch(); void qc.invalidateQueries({ queryKey: ['tickets'] }) }
  const reply = useMutation({
    mutationFn: async () => { const paths = ticket.client_id ? await uploadAll(ticket.client_id, files) : []; const { error } = await supabase.rpc('reply_ticket', { p_ticket_id: ticket.id, p_body: body, p_attachments: paths }); if (error) throw error },
    onSuccess: () => { setBody(''); setFiles([]); refresh() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const setStatus = useMutation({
    mutationFn: async (status: TicketStatus) => { const { error } = await supabase.rpc('set_ticket_status', { p_ticket_id: ticket.id, p_status: status }); if (error) throw error },
    onSuccess: refresh, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const closed = ticket.status === 'CLOSED'
  return (
    <Modal open size="lg" title={`${ticket.ticket_no} · ${ticket.subject}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[ticket.status]}>{t(`ticketStatus.${ticket.status}`)}</Badge>
          {!isClient && !closed && <Select aria-label={t('common.status')} value={ticket.status} className="w-44 py-1" onChange={(e) => setStatus.mutate(e.target.value as TicketStatus)}>{Constants.public.Enums.ticket_status.map((s) => <option key={s} value={s}>{t(`ticketStatus.${s}`)}</option>)}</Select>}
          {isClient && !closed && <Button size="sm" variant="secondary" onClick={() => setStatus.mutate('CLOSED')}>{t('support.close')}</Button>}</div>
        {events.isPending ? <Spinner /> : (
          <ol className="space-y-2" aria-label={t('support.trail')}>{(events.data ?? []).map((e) => e.kind === 'STATUS'
            ? <li key={e.id} className="text-center text-xs text-slate-500">{t(`ticketStatus.${e.status}`)} · {formatDateTime(e.created_at, i18n.resolvedLanguage)}{e.body ? ` · ${e.body}` : ''}</li>
            : <li key={e.id} className={`rounded-lg p-3 ${e.from_staff ? 'bg-brand-50' : 'bg-slate-50'}`}><div className="mb-1 text-xs text-slate-500">{e.from_staff ? t('support.staff') : t('support.you')} · {formatDateTime(e.created_at, i18n.resolvedLanguage)}</div><div className="whitespace-pre-wrap">{e.body}</div><Attachments paths={e.attachments} /></li>)}</ol>)}
        {!closed && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <Textarea aria-label={t('support.message')} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-2"><input type="file" multiple accept="image/*,application/pdf" aria-label={t('support.attach')} onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))} className="text-xs" />
              <Button loading={reply.isPending} disabled={!body.trim() || !profile} onClick={() => reply.mutate()}>{t('support.reply')}</Button></div>
          </div>)}
      </div>
    </Modal>
  )
}

export function SupportPage() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const isClient = profile?.role === 'CLIENT'
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const list = useQuery({ queryKey: ['tickets'], queryFn: async () => { const { data, error } = await supabase.from('support_tickets').select('*').order('updated_at', { ascending: false }).limit(300); if (error) throw error; return data as SupportTicket[] } })
  const rows = useMemo(() => (list.data ?? []).filter((r) => filter === 'all' || r.status !== 'CLOSED'), [list.data, filter])
  return (
    <div>
      <PageHeader title={t('support.title')} subtitle={t(isClient ? 'support.subtitleClient' : 'support.subtitleStaff')} actions={isClient && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>{t('support.new')}</Button>} />
      <div className="mb-3 flex gap-2">{(['open', 'all'] as const).map((k) => <Button key={k} size="sm" variant={filter === k ? 'primary' : 'secondary'} onClick={() => setFilter(k)}>{t(`support.filter.${k}`)}</Button>)}</div>
      <Card>
        {list.isPending ? <div className="flex justify-center p-8"><Spinner /></div> : list.error ? <ErrorState message={t('common.error')} onRetry={() => list.refetch()} /> : !rows.length ? <EmptyState message={t('support.none')} /> : (
          <ul className="divide-y divide-slate-100 text-sm">{rows.map((r) => <li key={r.id}><button className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-4 py-2 text-left hover:bg-slate-50" onClick={() => setOpenId(r.id)} data-testid="ticket-row">
            <span><span className="font-mono text-xs text-slate-500">{r.ticket_no}</span> <span className="font-medium">{r.subject}</span></span>
            <span className="flex items-center gap-2"><Badge tone={TONE[r.status]}>{t(`ticketStatus.${r.status}`)}</Badge><span className="text-xs text-slate-500">{formatDateTime(r.updated_at, i18n.resolvedLanguage)}</span></span></button></li>)}</ul>)}
      </Card>
      {adding && <NewTicket onClose={() => setAdding(false)} />}
      {openId && list.data?.find((x) => x.id === openId) && <TicketDetail ticket={list.data.find((x) => x.id === openId)!} isClient={isClient} onClose={() => setOpenId(null)} />}
    </div>
  )
}
