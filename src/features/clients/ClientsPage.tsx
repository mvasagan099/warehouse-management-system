import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Building, FileSignature, KeyRound, Pencil, Plus, ShieldCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Wand2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { generateTempPassword } from '../users/schema'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { gstinPan, gstinStateCode } from '../../lib/gstin'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { Constants, type Client } from '../../lib/types'
import { useClientGroups } from '../billing/queries'
import { qk, useClients } from '../shared/queries'
import { BillingOverrideDialog, GroupsDialog } from './ClientBillingDialogs'
import { ClientLoginDialog } from './ClientLoginDialog'
import { ClientWarehousesDialog } from './ClientWarehousesDialog'
import { CompaniesDialog } from './CompaniesDialog'
import { ContractsDialog } from './ContractsDialog'
import { clientSchema, clientToForm, emptyClient, type ClientFormInput, type ClientFormOutput } from './schema'

const TONE = { ACTIVE: 'green', ON_HOLD: 'amber', INACTIVE: 'gray' } as const

function ClientForm({ initial, title, saving, onClose, onSubmit }: {
  initial: ClientFormInput; title: string; saving: boolean; onClose: () => void; onSubmit: (v: ClientFormOutput) => void
}) {
  const { t } = useTranslation()
  const groups = useClientGroups()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ClientFormInput, unknown, ClientFormOutput>({
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
          <Field label={t('clients.loginPassword')} htmlFor="cf-login_password" optional error={errors.login_password?.message} hint={t('clients.loginPasswordHint')}>
            <div className="flex gap-1"><Input id="cf-login_password" autoComplete="new-password" className="font-mono" {...register('login_password')} />
              <Button type="button" variant="secondary" size="sm" aria-label={t('users.generate')} icon={<Wand2 className="h-4 w-4" />} onClick={() => setValue('login_password', generateTempPassword(), { shouldValidate: true })} /></div>
          </Field>
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
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">{t('clients.billingSection')}</legend>
          <Field label={t('clients.billingCycle')} htmlFor="cf-billing_cycle" hint={t('clients.billingCycleHelp')}>
            <Select id="cf-billing_cycle" {...register('billing_cycle')}>{Constants.public.Enums.billing_cycle.map((c) => <option key={c} value={c}>{t(`billingCycle.${c}`)}</option>)}</Select>
          </Field>
          <Field label={t('billing.mode')} htmlFor="cf-billing_mode">
            <Select id="cf-billing_mode" {...register('billing_mode')}>{Constants.public.Enums.billing_mode.map((m) => <option key={m} value={m}>{t(`billingMode.${m}`)}</option>)}</Select>
          </Field>
          <Field label={t('clients.paymentTerms')} htmlFor="cf-payment_terms_days" error={errors.payment_terms_days?.message}>
            <Input id="cf-payment_terms_days" inputMode="numeric" aria-invalid={!!errors.payment_terms_days} {...register('payment_terms_days')} />
          </Field>
          <Field label={t('clients.group')} htmlFor="cf-group_id" optional hint={t('clients.groupHelp')}>
            <Select id="cf-group_id" {...register('group_id')}><option value="">{t('clients.noGroup')}</option>{(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
          </Field>
          <div className="flex items-end pb-2"><Checkbox label={t('clients.gstExempt')} {...register('gst_exempt')} /></div>
          {watch('gst_exempt') && <Field label={t('billing.exemptReason')} htmlFor="cf-gst_exempt_reason" error={errors.gst_exempt_reason?.message}><Input id="cf-gst_exempt_reason" {...register('gst_exempt_reason')} /></Field>}
        </fieldset>
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
  const canEdit = profile?.role === 'SUPER_ADMIN' || profile?.role === 'WAREHOUSE_MANAGER'
  const qc = useQueryClient()
  const list = useClients()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [contractsFor, setContractsFor] = useState<Client | null>(null)
  const [companiesFor, setCompaniesFor] = useState<Client | null>(null)
  const [warehousesFor, setWarehousesFor] = useState<Client | null>(null)
  const [loginFor, setLoginFor] = useState<Client | null>(null)
  const [overrideFor, setOverrideFor] = useState<Client | null>(null)
  const [showGroups, setShowGroups] = useState(false)

  const save = useMutation({
    mutationFn: async (v: ClientFormOutput) => {
      const { login_password, ...row } = v
      const res = editing && editing !== 'new'
        ? await supabase.from('clients').update(row).eq('id', editing.id)
        : await supabase.from('clients').insert(row)
      if (res.error) throw res.error
      let loginCreated = false
      if (login_password && row.email) {
        let clientId = editing && editing !== 'new' ? editing.id : ''
        if (!clientId) {
          const { data, error } = await supabase.from('clients').select('id').eq('company_name', row.company_name).order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (error || !data) throw error ?? new Error('Client saved, but its login could not be created. Use the login button.')
          clientId = data.id
        }
        const { error } = await supabase.functions.invoke('create-user', { body: { email: row.email, password: login_password, full_name: row.contact_name || row.company_name, phone: row.phone || undefined, role: 'CLIENT', client_id: clientId, warehouse_ids: [] } })
        if (error) throw error
        loginCreated = true
      }
      return loginCreated
    },
    onSuccess: (loginCreated) => { toast.success(loginCreated ? t('clients.addedWithLogin') : editing === 'new' ? t('clients.added') : t('clients.updated')); setEditing(null); void qc.invalidateQueries({ queryKey: qk.clients }) },
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
          {canEdit && <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(row.original)}>{t('common.edit')}</Button>}
          <Button size="sm" variant="ghost" icon={<FileSignature className="h-4 w-4" />} onClick={() => setContractsFor(row.original)}>{t('contracts.title')}</Button>
          <Button size="sm" variant="ghost" icon={<Building className="h-4 w-4" />} onClick={() => setCompaniesFor(row.original)}>{t('companies.title')}</Button>
          {profile?.role === 'SUPER_ADMIN' && <Button size="sm" variant="ghost" onClick={() => setWarehousesFor(row.original)}>{t('clients.warehouses')}</Button>}
          {isAdmin && (
            <Button size="sm" variant="ghost" icon={<KeyRound className="h-4 w-4" />} onClick={() => setLoginFor(row.original)}>{t('clients.createLogin')}</Button>
          )}
          {isAdmin && <Button size="sm" variant="ghost" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setOverrideFor(row.original)}>{t('clients.billingOverride')}</Button>}
        </div>
      ),
    },
  ], [t, lang, isAdmin, canEdit])

  return (
    <div>
      <PageHeader title={t('clients.title')} actions={canEdit && <>{isAdmin && <Button variant="secondary" icon={<Users className="h-4 w-4" />} onClick={() => setShowGroups(true)}>{t('clients.groups')}</Button>}<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>{t('clients.add')}</Button></>} />
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
      {warehousesFor && <ClientWarehousesDialog clientId={warehousesFor.id} clientName={warehousesFor.company_name} onClose={() => setWarehousesFor(null)} />}
      {companiesFor && <CompaniesDialog clientId={companiesFor.id} clientName={companiesFor.company_name} onClose={() => setCompaniesFor(null)} />}
      {loginFor && (
        <ClientLoginDialog
          clientId={loginFor.id}
          clientName={loginFor.company_name}
          defaults={{ full_name: loginFor.contact_name ?? '', email: loginFor.email ?? '', phone: loginFor.phone ?? '' }}
          onClose={() => setLoginFor(null)}
        />
      )}
      {overrideFor && <BillingOverrideDialog client={overrideFor} onClose={() => setOverrideFor(null)} />}
      {showGroups && <GroupsDialog onClose={() => setShowGroups(false)} />}
    </div>
  )
}
