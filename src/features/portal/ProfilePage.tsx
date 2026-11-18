import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input } from '../../components/ui/Field'
import { Badge, Card, PageHeader } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { isValidGstin } from '../../lib/gstin'
import { supabase } from '../../lib/supabase'
import type { Client, ClientChangeRequest, ClientContact } from '../../lib/types'

const FIELDS = ['company_name', 'gstin', 'pan', 'address_line1', 'address_line2', 'city', 'district', 'state', 'pincode', 'contact_name', 'phone', 'email'] as const

/** A client's details. They ask for a change; an administrator approves it (the figures on invoices already issued never change). */
export function ProfilePage() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const clientId = profile?.client_id ?? ''
  const client = useQuery({ queryKey: ['my_client', clientId], enabled: !!clientId, queryFn: async () => { const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single(); if (error) throw error; return data as Client } })
  const requests = useQuery({ queryKey: ['change_requests'], queryFn: async () => { const { data, error } = await supabase.from('client_change_requests').select('*').order('created_at', { ascending: false }).limit(10); if (error) throw error; return data as ClientChangeRequest[] } })
  const contacts = useQuery({ queryKey: ['client_contacts'], queryFn: async () => { const { data, error } = await supabase.from('client_contacts').select('*').is('deleted_at', null).order('created_at'); if (error) throw error; return data as ClientContact[] } })
  const [edit, setEdit] = useState<Partial<Record<(typeof FIELDS)[number], string>>>({})
  const [c, setC] = useState({ name: '', email: '', phone: '', alerts: true })
  const pending = requests.data?.find((r) => r.status === 'PENDING')

  const changes = Object.fromEntries(Object.entries(edit).filter(([k, v]) => v !== undefined && v !== ((client.data as unknown as Record<string, string | null>)?.[k] ?? '')))
  const gstinBad = edit.gstin !== undefined && edit.gstin.trim() !== '' && !isValidGstin(edit.gstin.trim().toUpperCase())
  const send = useMutation({
    mutationFn: async () => {
      const clean = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, k === 'gstin' || k === 'pan' ? String(v).trim().toUpperCase() : String(v).trim()]))
      const { error } = await supabase.rpc('request_client_change', { p_changes: clean }); if (error) throw error
    },
    onSuccess: () => { toast.success(t('profile.requestSent')); setEdit({}); void qc.invalidateQueries({ queryKey: ['change_requests'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const addContact = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('client_contacts').insert({ client_id: clientId, name: c.name.trim(), email: c.email.trim() || null, phone: c.phone.trim() || null, notify_alerts: c.alerts }); if (error) throw error },
    onSuccess: () => { setC({ name: '', email: '', phone: '', alerts: true }); void contacts.refetch() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const toggle = useMutation({
    mutationFn: async (x: ClientContact) => { const { error } = await supabase.from('client_contacts').update({ notify_alerts: !x.notify_alerts }).eq('id', x.id); if (error) throw error },
    onSuccess: () => void contacts.refetch(), onError: async (e) => toast.error(await errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: async (x: ClientContact) => { const { error } = await supabase.from('client_contacts').update({ deleted_at: new Date().toISOString() }).eq('id', x.id); if (error) throw error },
    onSuccess: () => void contacts.refetch(), onError: async (e) => toast.error(await errorMessage(e)),
  })
  if (client.isPending) return <div className="flex justify-center p-8"><Spinner /></div>
  const cur = client.data as unknown as Record<string, string | null>
  return (
    <div className="space-y-4">
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      <Card className="p-4">
        {pending && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">{t('profile.pending', { date: formatDate(pending.created_at, i18n.resolvedLanguage) })}</p>}
        <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map((k) => (
          <Field key={k} label={t(`profile.fields.${k}`)} htmlFor={`pf-${k}`} error={k === 'gstin' && gstinBad ? t('validation.gstin') : undefined}>
            <Input id={`pf-${k}`} value={edit[k] ?? cur[k] ?? ''} disabled={!!pending} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} autoCapitalize={k === 'gstin' || k === 'pan' ? 'characters' : undefined} /></Field>))}</div>
        <div className="mt-4"><Button disabled={!!pending || Object.keys(changes).length === 0 || gstinBad} loading={send.isPending} onClick={() => send.mutate()}>{t('profile.askChange')}</Button></div>
        {requests.data && requests.data.some((r) => r.status !== 'PENDING') && (
          <ul className="mt-4 space-y-1 text-xs text-slate-600">{requests.data.filter((r) => r.status !== 'PENDING').slice(0, 3).map((r) => <li key={r.id}><Badge tone={r.status === 'APPROVED' ? 'green' : 'red'}>{t(`requestStatus.${r.status}`)}</Badge> {formatDate(r.created_at, i18n.resolvedLanguage)} {r.decision_note ? `· ${r.decision_note}` : ''}</li>)}</ul>)}
      </Card>
      <Card className="p-4">
        <h2 className="mb-1 font-semibold">{t('profile.contacts')}</h2><p className="mb-3 text-sm text-slate-500">{t('profile.contactsHelp')}</p>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">{(contacts.data ?? []).map((x) => (
          <li key={x.id} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-1"><span><span className="font-medium">{x.name}</span> <span className="text-slate-500">{[x.email, x.phone].filter(Boolean).join(' · ')}</span></span>
            <span className="flex items-center gap-2"><Checkbox label={t('profile.getsAlerts')} checked={x.notify_alerts} onChange={() => toggle.mutate(x)} /><Button size="sm" variant="ghost" aria-label={t('common.delete')} icon={<Trash2 className="h-4 w-4" />} onClick={() => remove.mutate(x)} /></span></li>))}
          {!contacts.data?.length && <li className="py-2 text-slate-500">{t('profile.noContacts')}</li>}</ul>
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label={t('common.name')} htmlFor="ct-n"><Input id="ct-n" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label={t('common.email')} htmlFor="ct-e"><Input id="ct-e" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
          <Field label={t('common.phone')} htmlFor="ct-p"><Input id="ct-p" type="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
          <div className="flex items-end"><Button icon={<Plus className="h-4 w-4" />} disabled={!c.name.trim() || (!c.email.trim() && !c.phone.trim())} loading={addContact.isPending} onClick={() => addContact.mutate()}>{t('profile.addContact')}</Button></div>
        </div>
      </Card>
    </div>
  )
}
