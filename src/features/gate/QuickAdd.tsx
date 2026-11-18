import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

/** Add a client without leaving the gate form: name is enough, phone and GSTIN are optional. */
export function QuickClient({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [f, setF] = useState({ name: '', phone: '', gstin: '' })
  const save = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc('quick_create_client', { p_name: f.name, p_phone: f.phone || undefined, p_gstin: f.gstin || undefined }); if (error) throw error; return data as string },
    onSuccess: async (id) => { await qc.invalidateQueries({ queryKey: ['clients'] }); toast.success(t('gate.clientAdded')); onCreated(id) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('gate.newClient')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} disabled={f.name.trim().length < 2} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid gap-3">
        <Field label={t('clients.companyName')} htmlFor="qc-name"><Input id="qc-name" className="h-12 text-base" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label={t('common.phone')} htmlFor="qc-phone" optional><Input id="qc-phone" type="tel" className="h-12 text-base" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="GSTIN" htmlFor="qc-gstin" optional><Input id="qc-gstin" className="h-12 text-base uppercase" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

/** Add the sender / receiver company of a client on the spot. */
export function QuickCompany({ clientId, onClose, onCreated }: { clientId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const save = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.from('company_master').insert({ client_id: clientId, name: name.trim(), kind: 'BOTH' }).select('id').single(); if (error) throw error; return data.id },
    onSuccess: async (id) => { await qc.invalidateQueries({ queryKey: ['companies'] }); toast.success(t('gate.companyAdded')); onCreated(id) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('gate.newCompany')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} disabled={name.trim().length < 2} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid gap-3">
        <Field label={t('common.name')} htmlFor="qco-name"><Input id="qco-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <p className="text-sm text-slate-500">{t('gate.companyBothHelp')}</p>
      </div>
    </Modal>
  )
}
