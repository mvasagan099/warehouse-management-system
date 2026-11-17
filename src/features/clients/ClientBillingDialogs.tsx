import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Client } from '../../lib/types'
import { useClientGroups } from '../billing/queries'
import { qk } from '../shared/queries'

/** Client groups share a rate card (scope GROUP). */
export function GroupsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const groups = useClientGroups()
  const [name, setName] = useState('')
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from('client_groups').insert({ name: name.trim() }); if (error) throw error },
    onSuccess: () => { setName(''); toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['client_groups'] }) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('clients.groups')} onClose={onClose}>
      <ul className="mb-4 space-y-1 text-sm">{(groups.data ?? []).map((g) => <li key={g.id} className="rounded-lg bg-slate-50 px-3 py-1.5">{g.name}</li>)}{!groups.data?.length && <li className="text-slate-500">{t('clients.noGroups')}</li>}</ul>
      <div className="flex gap-2"><Input aria-label={t('common.name')} placeholder={t('clients.groupName')} value={name} onChange={(e) => setName(e.target.value)} /><Button loading={add.isPending} disabled={!name.trim()} onClick={() => add.mutate()}>{t('common.create')}</Button></div>
    </Modal>
  )
}

/** Lets an administrator let a blocked client keep booking and dispatching until a date. */
export function BillingOverrideDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [until, setUntil] = useState('')
  const [reason, setReason] = useState('')
  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc('set_billing_override', { p_client_id: client.id, p_until: until, p_reason: reason.trim() }); if (error) throw error },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: qk.clients }); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={`${t('clients.billingOverride')} · ${client.company_name}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={!until || !reason.trim()} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">{t('clients.billingOverrideHelp')}</p>
        {client.billing_override_until && <p className="rounded-lg bg-amber-50 p-2 text-amber-800">{t('clients.overrideUntil', { date: formatDate(client.billing_override_until, i18n.resolvedLanguage), reason: client.billing_override_reason ?? '' })}</p>}
        <Field label={t('clients.overrideUntilLabel')} htmlFor="bo-until"><Input id="bo-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
        <Field label={t('common.reasonRequired')} htmlFor="bo-reason"><Input id="bo-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
