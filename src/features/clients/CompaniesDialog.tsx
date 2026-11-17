import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { gstinPan, gstinStateCode } from '../../lib/gstin'
import { supabase } from '../../lib/supabase'
import { Constants, type Company } from '../../lib/types'
import { useCompanies } from '../shared/queries'
import { companySchema, companyToForm, emptyCompany, type CompanyFormInput, type CompanyFormOutput } from './schema'

function CompanyForm({ initial, saving, onClose, onSubmit }: {
  initial: CompanyFormInput; saving: boolean; onClose: () => void; onSubmit: (v: CompanyFormOutput) => void
}) {
  const { t } = useTranslation()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CompanyFormInput, unknown, CompanyFormOutput>({
    resolver: zodResolver(companySchema), defaultValues: initial,
  })
  const gstin = watch('gstin') ?? ''
  const code = gstinStateCode(gstin)
  const f = (name: keyof CompanyFormInput, label: string, opts: { optional?: boolean; type?: string } = {}) => (
    <Field label={label} htmlFor={`co-${name}`} error={errors[name]?.message} optional={opts.optional}>
      <Input id={`co-${name}`} type={opts.type ?? 'text'} aria-invalid={!!errors[name]} {...register(name)} />
    </Field>
  )
  return (
    <Modal open size="lg" title={initial.name ? t('companies.edit') : t('companies.add')} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="company-form" loading={saving}>{t('common.save')}</Button>
      </>
    }>
      <form id="company-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">{f('name', t('companies.name'))}</div>
        <Field label={t('companies.kind')} htmlFor="co-kind">
          <Select id="co-kind" {...register('kind')}>
            {Constants.public.Enums.company_kind.map((k) => <option key={k} value={k}>{t(`companyKind.${k}`)}</option>)}
          </Select>
        </Field>
        <Field label="GSTIN" htmlFor="co-gstin" optional error={errors.gstin?.message}
          hint={code && /^\d{2}$/.test(code) ? `${t('clients.stateCode')}: ${code}${gstinPan(gstin) ? ` · PAN ${gstinPan(gstin)}` : ''}` : undefined}>
          <Input id="co-gstin" maxLength={15} className="uppercase" aria-invalid={!!errors.gstin} {...register('gstin')} />
        </Field>
        {f('pan', 'PAN', { optional: true })}
        {f('contact_name', t('clients.contactName'), { optional: true })}
        {f('phone', t('common.phone'), { optional: true, type: 'tel' })}
        {f('email', t('common.email'), { optional: true, type: 'email' })}
        {f('address_line1', t('warehouses.address1'), { optional: true })}
        {f('address_line2', t('warehouses.address2'), { optional: true })}
        {f('city', t('warehouses.city'), { optional: true })}
        {f('district', t('warehouses.district'), { optional: true })}
        {f('state', t('warehouses.state'), { optional: true })}
        {f('pincode', t('warehouses.pincode'), { optional: true })}
      </form>
    </Modal>
  )
}

/** Sender / receiver companies of one client: staff pick from this list on inward and outward documents. */
export function CompaniesDialog({ clientId, clientName, onClose }: { clientId: string; clientName: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const list = useCompanies(clientId)
  const [editing, setEditing] = useState<Company | 'new' | null>(null)

  const save = useMutation({
    mutationFn: async (v: CompanyFormOutput) => {
      const res = editing && editing !== 'new'
        ? await supabase.from('company_master').update(v).eq('id', editing.id)
        : await supabase.from('company_master').insert({ ...v, client_id: clientId })
      if (res.error) throw res.error
    },
    onSuccess: () => { toast.success(t('common.saved')); setEditing(null); void qc.invalidateQueries({ queryKey: ['companies'] }) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const columns = useMemo<ColumnDef<Company>[]>(() => [
    { accessorKey: 'name', header: t('common.name'), cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
    { accessorKey: 'kind', header: t('companies.kind'), cell: (c) => <Badge tone="cyan">{t(`companyKind.${c.getValue<string>()}`)}</Badge> },
    { accessorKey: 'gstin', header: 'GSTIN', cell: (c) => <span className="font-mono text-xs">{c.getValue<string | null>() ?? '—'}</span> },
    { accessorKey: 'state', header: t('warehouses.state'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { id: 'a', header: '', cell: ({ row }) => <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(row.original)}>{t('common.edit')}</Button> },
  ], [t])

  return (
    <>
      <Modal open size="lg" title={`${t('companies.title')} — ${clientName}`} onClose={onClose}>
        <div className="mb-3 flex justify-end">
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>{t('companies.add')}</Button>
        </div>
        <DataTable data={list.data} columns={columns} loading={list.isPending} error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()} emptyMessage={t('companies.empty')} pageSize={8} />
      </Modal>
      {editing && (
        <CompanyForm
          initial={editing === 'new' ? emptyCompany : companyToForm(editing)}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => save.mutate(v)}
        />
      )}
    </>
  )
}
