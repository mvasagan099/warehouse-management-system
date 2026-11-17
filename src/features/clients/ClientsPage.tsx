import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Building, FileSignature, KeyRound, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { gstinPan, gstinStateCode } from '../../lib/gstin'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { Constants, type Client } from '../../lib/types'
import { qk, useClients } from '../shared/queries'
import { ClientLoginDialog } from './ClientLoginDialog'
import { CompaniesDialog } from './CompaniesDialog'
import { ContractsDialog } from './ContractsDialog'
import { clientSchema, clientToForm, emptyClient, type ClientFormInput, type ClientFormOutput } from './schema'

const TONE = { ACTIVE: 'green', ON_HOLD: 'amber', INACTIVE: 'gray' } as const

function ClientForm({ initial, title, saving, onClose, onSubmit }: {
  initial: ClientFormInput; title: string; saving: boolean; onClose: () => void; onSubmit: (v: ClientFormOutput) => void
}) {
  const { t } = useTranslation()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ClientFormInput, unknown, ClientFormOutput>({
    resolver: zodResolver(clientSchema), defaultValues: initial,
  })
  const gstin = (watch('gstin') ?? '').toUpperCase()
  const code = gstinStateCode(gstin)
  const f = (name: keyof ClientFormInput, label: string, opts: { optional?: boolean; type?: string; hint?: string; inputMode?: 'decimal' | 'numeric' | 'tel' | 'email' } = {}) => (
    <Field label={label} htmlFor={`cf-${name}`} error={errors[name]?.message} optional={opts.optional} hint={opts.hint}>
      <Input id={`cf-${name}`} type={opts.type ?? 'text'} inputMode={opts.inputMode} aria-invalid={!!errors[name]} {...register(name)} />
    </Field>
  )
  return (
    <Modal open size="lg" title={title} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="client-form" loading={saving}>{t('common.save')}</Button>
      </>
    }>
      <form id="client-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{f('company_name', t('clients.companyName'))}</div>
          <Field label="GSTIN" htmlFor="cf-gstin" optional error={errors.gstin?.message}
            hint={code && /^\d{2}$/.test(code) ? `${t('clients.stateCode')}: ${code}${gstinPan(gstin) ? ` · PAN ${gstinPan(gstin)}` : ''}` : t('clients.gstinHelp')}>
            <Input id="cf-gstin" maxLength={15} className="uppercase" aria-invalid={!!errors.gstin} {...register('gstin')} />
          </Field>
          {f('pan', 'PAN', { optional: true })}
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">{t('warehouses.sectionAddress')}</legend>
          {f('address_line1', t('warehouses.address1'), { optional: true })}
          {f('address_line2', t('warehouses.address2'), { optional: true })}
          {f('city', t('warehouses.city'), { optional: true })}
          {f('district', t('warehouses.district'), { optional: true })}
          {f('state', t('warehouses.state'), { optional: true })}
          {f('pincode', t('warehouses.pincode'), { optional: true, inputMode: 'numeric' })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">{t('warehouses.sectionContact')}</legend>
          {f('contact_name', t('clients.contactName'), { optional: true })}
          {f('phone', t('common.phone'), { optional: true, type: 'tel', inputMode: 'tel' })}
          {f('email', t('common.email'), { optional: true, type: 'email', inputMode: 'email' })}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          {f('credit_limit_paise', t('clients.creditLimit'), { inputMode: 'decimal', hint: t('clients.creditHelp') })}
          <Field label={t('clients.pickRule')} htmlFor="cf-pick_rule" hint={t('clients.pickRuleHelp')}>
            <Select id="cf-pick_rule" {...register('pick_rule')}>
              {Constants.public.Enums.pick_rule.map((r) => <option key={r} value={r}>{t(`pickRule.${r}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('common.status')} htmlFor="cf-status">
            <Select id="cf-status" {...register('status')}>
              {Constants.public.Enums.client_status.map((s) => <option key={s} value={s}>{t(`clientStatus.${s}`)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t('common.notes')} htmlFor="cf-notes" optional error={errors.notes?.message}>
          <Textarea id="cf-notes" {...register('notes')} />
        </Field>
      </form>
    </Modal>
  )
}

export function ClientsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'SUPER_ADMIN'
  const qc = useQueryClient()
  const list = useClients()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [contractsFor, setContractsFor] = useState<Client | null>(null)
  const [companiesFor, setCompaniesFor] = useState<Client | null>(null)
  const [loginFor, setLoginFor] = useState<Client | null>(null)

  const save = useMutation({
    mutationFn: async (v: ClientFormOutput) => {
      const res = editing && editing !== 'new'
        ? await supabase.from('clients').update(v).eq('id', editing.id)
        : await supabase.from('clients').insert(v)
      if (res.error) throw res.error
    },
    onSuccess: () => { toast.success(editing === 'new' ? t('clients.added') : t('clients.updated')); setEditing(null); void qc.invalidateQueries({ queryKey: qk.clients }) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const rows = useMemo(() => (list.data ?? []).filter((c) => !statusFilter || c.status === statusFilter), [list.data, statusFilter])

  const columns = useMemo<ColumnDef<Client>[]>(() => [
    { accessorKey: 'code', header: t('common.code'), cell: (c) => <span className="font-mono">{c.getValue<string>()}</span> },
    { accessorKey: 'company_name', header: t('clients.companyName'), cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
    { accessorKey: 'gstin', header: 'GSTIN', cell: (c) => <span className="font-mono text-xs">{c.getValue<string | null>() ?? '—'}</span> },
    { accessorKey: 'state', header: t('warehouses.state'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { accessorKey: 'contact_name', header: t('clients.contactName'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { accessorKey: 'credit_limit_paise', header: t('clients.creditLimit'), cell: (c) => formatINR(c.getValue<number>(), lang) },
    { accessorKey: 'pick_rule', header: t('clients.pickRule') },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={TONE[c.getValue<Client['status']>()]}>{t(`clientStatus.${c.getValue<string>()}`)}</Badge> },
    {
      id: 'actions', header: t('common.actions'),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(row.original)}>{t('common.edit')}</Button>
          <Button size="sm" variant="ghost" icon={<FileSignature className="h-4 w-4" />} onClick={() => setContractsFor(row.original)}>{t('contracts.title')}</Button>
          <Button size="sm" variant="ghost" icon={<Building className="h-4 w-4" />} onClick={() => setCompaniesFor(row.original)}>{t('companies.title')}</Button>
          {isAdmin && (
            <Button size="sm" variant="ghost" icon={<KeyRound className="h-4 w-4" />} onClick={() => setLoginFor(row.original)}>{t('clients.createLogin')}</Button>
          )}
        </div>
      ),
    },
  ], [t, lang, isAdmin])

  return (
    <div>
      <PageHeader title={t('clients.title')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>{t('clients.add')}</Button>} />
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-72" aria-label={t('common.search')} />
          <Select aria-label={t('common.status')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44">
            <option value="">{t('common.all')}</option>
            {Constants.public.Enums.client_status.map((s) => <option key={s} value={s}>{t(`clientStatus.${s}`)}</option>)}
          </Select>
        </Toolbar>
        <DataTable data={rows} columns={columns} loading={list.isPending} error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()} search={search} filtered={!!statusFilter} emptyMessage={t('clients.empty')} />
      </Card>
      {editing && (
        <ClientForm
          title={editing === 'new' ? t('clients.add') : t('clients.edit')}
          initial={editing === 'new' ? emptyClient : clientToForm(editing)}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => save.mutate(v)}
        />
      )}
      {contractsFor && <ContractsDialog clientId={contractsFor.id} clientName={contractsFor.company_name} canEdit onClose={() => setContractsFor(null)} />}
      {companiesFor && <CompaniesDialog clientId={companiesFor.id} clientName={companiesFor.company_name} onClose={() => setCompaniesFor(null)} />}
      {loginFor && (
        <ClientLoginDialog
          clientId={loginFor.id}
          clientName={loginFor.company_name}
          defaults={{ full_name: loginFor.contact_name ?? '', email: loginFor.email ?? '', phone: loginFor.phone ?? '' }}
          onClose={() => setLoginFor(null)}
        />
      )}
    </div>
  )
}
