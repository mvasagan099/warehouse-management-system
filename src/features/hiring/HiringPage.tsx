import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { Eye, Pencil, Plus, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { Constants, type Applicant, type ApplicantStatus, type Vacancy } from '../../lib/types'
import { optionalEmail, optionalPhone, optionalText, positiveInt, requiredText } from '../../lib/zod'
import { useWarehouses } from '../shared/queries'
import { CreateUserDialog } from '../users/CreateUserDialog'
import { ApplicantDetail } from './ApplicantDetail'

// ---------- schemas ----------
const vacancySchema = z.object({
  warehouse_id: z.string().transform((v) => (v === '' ? null : v)),
  title: requiredText(150),
  job_role: z.enum(Constants.public.Enums.job_role),
  openings: positiveInt,
  status: z.enum(Constants.public.Enums.vacancy_status),
  description: optionalText(2000),
  salary_min: z.string().optional(),
  salary_max: z.string().optional(),
})
type VacancyIn = z.input<typeof vacancySchema>
type VacancyOut = z.output<typeof vacancySchema>

const applicantSchema = z.object({
  vacancy_id: z.string().min(1, 'validation.required'),
  full_name: requiredText(150),
  email: optionalEmail,
  phone: optionalPhone,
  status: z.enum(Constants.public.Enums.applicant_status),
  notes: optionalText(2000),
})
type ApplicantIn = z.input<typeof applicantSchema>
type ApplicantOut = z.output<typeof applicantSchema>

/** The login role a job needs. */
export const loginRoleFor = (j: string): 'WAREHOUSE_MANAGER' | 'STAFF' | 'ACCOUNTANT' => (j === 'MANAGER' ? 'WAREHOUSE_MANAGER' : j === 'ACCOUNTANT' ? 'ACCOUNTANT' : 'STAFF')

const APPLICANT_TONE: Record<ApplicantStatus, 'gray' | 'blue' | 'violet' | 'green' | 'red' | 'cyan'> = {
  APPLIED: 'gray', SHORTLISTED: 'cyan', INTERVIEW: 'blue', OFFERED: 'violet', JOINED: 'green', REJECTED: 'red',
}

function useHiring() {
  return useQuery({
    queryKey: ['hiring'],
    queryFn: async () => {
      const [v, a] = await Promise.all([
        supabase.from('vacancies').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('applicants').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      ])
      if (v.error) throw v.error
      if (a.error) throw a.error
      return { vacancies: v.data, applicants: a.data }
    },
  })
}

function VacancyForm({ initial, title, onClose, onSubmit, saving }: { initial: VacancyIn; title: string; saving: boolean; onClose: () => void; onSubmit: (v: VacancyOut) => void }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const warehouses = useWarehouses()
  const { register, handleSubmit, formState: { errors } } = useForm<VacancyIn, unknown, VacancyOut>({ resolver: zodResolver(vacancySchema), defaultValues: initial })
  return (
    <Modal open title={title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" form="vac-form" loading={saving}>{t('common.save')}</Button></>}>
      <form id="vac-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('hiring.vacancyTitle')} htmlFor="v-title" error={errors.title?.message} className="sm:col-span-2"><Input id="v-title" {...register('title')} /></Field>
        <Field label={t('common.warehouse')} htmlFor="v-wh" error={errors.warehouse_id?.message}>
          <Select id="v-wh" {...register('warehouse_id')}>
            {profile?.role === 'SUPER_ADMIN' && <option value="">{t('hiring.headOffice')}</option>}
            {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
          </Select>
        </Field>
        <Field label={t('hiring.jobRole')} htmlFor="v-role">
          <Select id="v-role" {...register('job_role')}>
            {Constants.public.Enums.job_role.map((r) => <option key={r} value={r}>{t(`jobRole.${r}`)}</option>)}
          </Select>
        </Field>
        {profile?.role === 'SUPER_ADMIN' && (
          <>
            <Field label={t('hiring.salaryMin')} htmlFor="v-smin" optional hint={t('hiring.salaryHint')}><Input id="v-smin" type="number" min={0} step="100" {...register('salary_min')} /></Field>
            <Field label={t('hiring.salaryMax')} htmlFor="v-smax" optional><Input id="v-smax" type="number" min={0} step="100" {...register('salary_max')} /></Field>
          </>
        )}
        <Field label={t('hiring.openings')} htmlFor="v-open" error={errors.openings?.message}><Input id="v-open" type="number" min={1} {...register('openings')} /></Field>
        <Field label={t('common.status')} htmlFor="v-status">
          <Select id="v-status" {...register('status')}>
            {Constants.public.Enums.vacancy_status.map((s) => <option key={s} value={s}>{t(`vacancyStatus.${s}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('hiring.description')} htmlFor="v-desc" optional error={errors.description?.message} className="sm:col-span-2"><Textarea id="v-desc" {...register('description')} /></Field>
      </form>
    </Modal>
  )
}

function ApplicantForm({ initial, title, vacancies, onClose, onSubmit, saving }: { initial: ApplicantIn; title: string; vacancies: Vacancy[]; saving: boolean; onClose: () => void; onSubmit: (v: ApplicantOut) => void }) {
  const { t } = useTranslation()
  const { register, handleSubmit, formState: { errors } } = useForm<ApplicantIn, unknown, ApplicantOut>({ resolver: zodResolver(applicantSchema), defaultValues: initial })
  return (
    <Modal open title={title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" form="app-form" loading={saving}>{t('common.save')}</Button></>}>
      <form id="app-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('hiring.vacancy')} htmlFor="a-vac" error={errors.vacancy_id?.message} className="sm:col-span-2">
          <Select id="a-vac" {...register('vacancy_id')}>
            <option value="">{t('common.select')}</option>
            {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
          </Select>
        </Field>
        <Field label={t('users.fullName')} htmlFor="a-name" error={errors.full_name?.message} className="sm:col-span-2"><Input id="a-name" {...register('full_name')} /></Field>
        <Field label={t('common.email')} htmlFor="a-email" optional error={errors.email?.message}><Input id="a-email" type="email" {...register('email')} /></Field>
        <Field label={t('common.phone')} htmlFor="a-phone" optional error={errors.phone?.message}><Input id="a-phone" type="tel" {...register('phone')} /></Field>
        <Field label={t('common.status')} htmlFor="a-status">
          <Select id="a-status" {...register('status')}>
            {Constants.public.Enums.applicant_status.map((s) => <option key={s} value={s}>{t(`applicantStatus.${s}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('common.notes')} htmlFor="a-notes" optional error={errors.notes?.message} className="sm:col-span-2"><Textarea id="a-notes" {...register('notes')} /></Field>
      </form>
    </Modal>
  )
}

export function HiringPage() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'SUPER_ADMIN'
  const qc = useQueryClient()
  const hiring = useHiring()
  const warehouses = useWarehouses()
  const [tab, setTab] = useState<'vacancies' | 'applicants'>('vacancies')
  const [search, setSearch] = useState('')
  const [vacancyFilter, setVacancyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editVacancy, setEditVacancy] = useState<Vacancy | 'new' | null>(null)
  const [editApplicant, setEditApplicant] = useState<Applicant | 'new' | null>(null)
  const [accountFor, setAccountFor] = useState<Applicant | null>(null)
  const [detail, setDetail] = useState<Applicant | null>(null)

  const vacancies = useMemo(() => hiring.data?.vacancies ?? [], [hiring.data])
  const vacancyById = useMemo(() => new Map(vacancies.map((v) => [v.id, v])), [vacancies])
  const whLabel = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, `${w.code} · ${w.name}`])), [warehouses.data])
  const refresh = () => void qc.invalidateQueries({ queryKey: ['hiring'] })
  const fail = async (e: unknown) => toast.error(await errorMessage(e))

  const saveVacancy = useMutation({
    mutationFn: async (v: VacancyOut) => {
      const { salary_min, salary_max, ...rest } = v
      const row = { ...rest, role_to_hire: loginRoleFor(v.job_role) }
      const r = editVacancy && editVacancy !== 'new' ? await supabase.from('vacancies').update(row).eq('id', editVacancy.id).select('id').single() : await supabase.from('vacancies').insert(row).select('id').single()
      if (r.error) throw r.error
      if (isAdmin && salary_min !== undefined && salary_min !== '' && salary_max !== undefined && salary_max !== '') {
        const sal = await supabase.from('vacancy_salaries').upsert({ vacancy_id: r.data.id, min_paise: Math.round(Number(salary_min) * 100), max_paise: Math.round(Number(salary_max) * 100) })
        if (sal.error) throw sal.error
      }
    },
    onSuccess: () => { toast.success(t('hiring.saved')); setEditVacancy(null); refresh() },
    onError: fail,
  })
  const saveApplicant = useMutation({
    mutationFn: async (v: ApplicantOut) => {
      const r = editApplicant && editApplicant !== 'new' ? await supabase.from('applicants').update(v).eq('id', editApplicant.id) : await supabase.from('applicants').insert(v)
      if (r.error) throw r.error
    },
    onSuccess: () => { toast.success(t('hiring.saved')); setEditApplicant(null); refresh() },
    onError: fail,
  })
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ApplicantStatus }) => {
      const { error } = await supabase.from('applicants').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('hiring.statusChanged')); refresh() },
    onError: fail,
  })

  const vacancyColumns = useMemo<ColumnDef<Vacancy>[]>(() => [
    { accessorKey: 'title', header: t('hiring.vacancyTitle'), cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
    { id: 'wh', header: t('common.warehouse'), accessorFn: (v) => (v.warehouse_id ? whLabel.get(v.warehouse_id) ?? '' : t('hiring.headOffice')) },
    { accessorKey: 'job_role', header: t('hiring.jobRole'), cell: (c) => t(`jobRole.${c.getValue<string>()}`) },
    { accessorKey: 'openings', header: t('hiring.openings') },
    { id: 'count', header: t('hiring.applicants'), cell: (c) => (hiring.data?.applicants ?? []).filter((a) => a.vacancy_id === c.row.original.id).length },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={c.getValue() === 'OPEN' ? 'green' : 'gray'}>{t(`vacancyStatus.${c.getValue<string>()}`)}</Badge> },
    { accessorKey: 'created_at', header: t('common.createdAt'), cell: (c) => formatDate(c.getValue<string>(), i18n.resolvedLanguage) },
    { id: 'actions', header: t('common.actions'), cell: ({ row }) => <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditVacancy(row.original)}>{t('common.edit')}</Button> },
  ], [t, i18n.resolvedLanguage, whLabel, hiring.data])

  const applicantColumns = useMemo<ColumnDef<Applicant>[]>(() => [
    { accessorKey: 'full_name', header: t('users.fullName'), cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
    { id: 'vac', header: t('hiring.vacancy'), accessorFn: (a) => vacancyById.get(a.vacancy_id)?.title ?? '' },
    { id: 'contact', header: t('common.phone'), accessorFn: (a) => [a.phone, a.email].filter(Boolean).join(' · ') },
    {
      accessorKey: 'status',
      header: t('common.status'),
      cell: ({ row }) => row.original.user_id ? (
        <Badge tone={APPLICANT_TONE[row.original.status]}>{t(`applicantStatus.${row.original.status}`)}</Badge>
      ) : (
        <Select aria-label={t('common.status')} value={row.original.status} className="w-36 py-1" onChange={(e) => setStatus.mutate({ id: row.original.id, status: e.target.value as ApplicantStatus })}>
          {Constants.public.Enums.applicant_status.filter((s) => s !== 'JOINED').map((s) => <option key={s} value={s}>{t(`applicantStatus.${s}`)}</option>)}
        </Select>
      ),
    },
    { accessorKey: 'status_changed_at', header: t('common.updatedAt'), cell: (c) => formatDate(c.getValue<string>(), i18n.resolvedLanguage) },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        const a = row.original
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => setDetail(a)}>{t('hiring.details')}</Button>
            <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditApplicant(a)}>{t('common.edit')}</Button>
            {a.user_id ? (
              <Badge tone="green">{t('hiring.hasAccount')}</Badge>
            ) : isAdmin && a.status === 'OFFERED' ? (
              <Button size="sm" icon={<UserCheck className="h-4 w-4" />} onClick={() => setAccountFor(a)}>{t('hiring.createAccount')}</Button>
            ) : null}
          </div>
        )
      },
    },
  ], [t, i18n.resolvedLanguage, vacancyById, isAdmin, setStatus])

  const applicants = (hiring.data?.applicants ?? []).filter((a) => (!vacancyFilter || a.vacancy_id === vacancyFilter) && (!statusFilter || a.status === statusFilter))
  const accountVacancy = accountFor ? vacancyById.get(accountFor.vacancy_id) : undefined

  return (
    <div>
      <PageHeader
        title={t('hiring.title')}
        actions={
          tab === 'vacancies'
            ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditVacancy('new')}>{t('hiring.addVacancy')}</Button>
            : <Button icon={<Plus className="h-4 w-4" />} disabled={vacancies.length === 0} title={vacancies.length === 0 ? t('hiring.needsVacancy') : undefined} onClick={() => setEditApplicant('new')}>{t('hiring.addApplicant')}</Button>
        }
      />
      <div className="mb-3 flex gap-1 border-b border-slate-200" role="tablist">
        {(['vacancies', 'applicants'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setSearch('') }}
            className={clsx('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === k ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            {t(`hiring.${k}`)}
          </button>
        ))}
      </div>
      <Card>
        <Toolbar>
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label={t('common.search')} />
          {tab === 'applicants' && (
            <>
              <Select aria-label={t('hiring.vacancy')} value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)} className="sm:w-56">
                <option value="">{t('hiring.allVacancies')}</option>
                {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </Select>
              <Select aria-label={t('common.status')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44">
                <option value="">{t('common.all')}</option>
                {Constants.public.Enums.applicant_status.map((s) => <option key={s} value={s}>{t(`applicantStatus.${s}`)}</option>)}
              </Select>
            </>
          )}
        </Toolbar>
        {tab === 'vacancies' ? (
          <DataTable data={vacancies} columns={vacancyColumns} loading={hiring.isPending} error={hiring.error ? t('common.error') : null} onRetry={() => hiring.refetch()} search={search} />
        ) : (
          <DataTable data={applicants} columns={applicantColumns} loading={hiring.isPending} error={hiring.error ? t('common.error') : null} onRetry={() => hiring.refetch()} search={search} filtered={!!vacancyFilter || !!statusFilter} />
        )}
      </Card>

      {editVacancy && (
        <VacancyForm
          title={editVacancy === 'new' ? t('hiring.addVacancy') : t('hiring.editVacancy')}
          initial={editVacancy === 'new'
            ? { warehouse_id: isAdmin ? '' : (warehouses.data?.[0]?.id ?? ''), title: '', job_role: 'LOADER', openings: '1', status: 'OPEN', description: '', salary_min: '', salary_max: '' }
            : { warehouse_id: editVacancy.warehouse_id ?? '', title: editVacancy.title, job_role: editVacancy.job_role, openings: String(editVacancy.openings), status: editVacancy.status, description: editVacancy.description ?? '', salary_min: '', salary_max: '' }}
          saving={saveVacancy.isPending}
          onClose={() => setEditVacancy(null)}
          onSubmit={(v) => saveVacancy.mutate(v)}
        />
      )}
      {editApplicant && (
        <ApplicantForm
          title={editApplicant === 'new' ? t('hiring.addApplicant') : t('hiring.editApplicant')}
          vacancies={vacancies}
          initial={editApplicant === 'new'
            ? { vacancy_id: vacancyFilter || (vacancies[0]?.id ?? ''), full_name: '', email: '', phone: '', status: 'APPLIED', notes: '' }
            : { vacancy_id: editApplicant.vacancy_id, full_name: editApplicant.full_name, email: editApplicant.email ?? '', phone: editApplicant.phone ?? '', status: editApplicant.status, notes: editApplicant.notes ?? '' }}
          saving={saveApplicant.isPending}
          onClose={() => setEditApplicant(null)}
          onSubmit={(v) => saveApplicant.mutate(v)}
        />
      )}
      {detail && <ApplicantDetail applicant={detail} vacancy={vacancyById.get(detail.vacancy_id)} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); refresh() }} />}
      {accountFor && (
        <CreateUserDialog
          title={`${t('hiring.createAccount')} — ${accountFor.full_name}`}
          applicantId={accountFor.id}
          initial={{
            full_name: accountFor.full_name,
            email: accountFor.email ?? '',
            phone: accountFor.phone ?? '',
            role: (accountVacancy?.role_to_hire as 'STAFF' | 'WAREHOUSE_MANAGER' | 'ACCOUNTANT') ?? 'STAFF',
            warehouse_ids: accountVacancy?.warehouse_id ? [accountVacancy.warehouse_id] : [],
          }}
          onClose={() => setAccountFor(null)}
          onCreated={() => { setAccountFor(null); toast.success(t('hiring.accountCreated')); refresh(); void qc.invalidateQueries({ queryKey: ['users'] }) }}
        />
      )}
    </div>
  )
}
