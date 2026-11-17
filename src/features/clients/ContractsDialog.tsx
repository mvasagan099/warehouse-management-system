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
import { formatDate } from '../../lib/format'
import { formatINR } from '../../lib/money'
import { supabase } from '../../lib/supabase'
import { Constants, type Contract } from '../../lib/types'
import { useContracts, useWarehouses } from '../shared/queries'
import { contractSchema, contractToForm, emptyContract, type ContractFormInput, type ContractFormOutput } from './schema'

const TONE = { DRAFT: 'gray', ACTIVE: 'green', EXPIRED: 'amber', TERMINATED: 'red' } as const

function ContractForm({ initial, saving, onClose, onSubmit }: {
  initial: ContractFormInput; saving: boolean; onClose: () => void; onSubmit: (v: ContractFormOutput) => void
}) {
  const { t } = useTranslation()
  const warehouses = useWarehouses()
  const { register, handleSubmit, formState: { errors } } = useForm<ContractFormInput, unknown, ContractFormOutput>({
    resolver: zodResolver(contractSchema), defaultValues: initial,
  })
  const num = (name: keyof ContractFormInput, label: string, type = 'text') => (
    <Field label={label} htmlFor={`ct-${name}`} error={errors[name]?.message}>
      <Input id={`ct-${name}`} type={type} inputMode={type === 'date' ? undefined : 'decimal'} {...register(name)} />
    </Field>
  )
  return (
    <Modal open size="lg" title={t('contracts.title')} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="contract-form" loading={saving}>{t('common.save')}</Button>
      </>
    }>
      <form id="contract-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('common.warehouse')} htmlFor="ct-warehouse_id" error={errors.warehouse_id?.message}>
          <Select id="ct-warehouse_id" {...register('warehouse_id')}>
            <option value="">{t('common.select')}</option>
            {warehouses.data?.filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
          </Select>
        </Field>
        <Field label={t('contracts.contractNo')} htmlFor="ct-contract_no" optional error={errors.contract_no?.message}>
          <Input id="ct-contract_no" {...register('contract_no')} />
        </Field>
        {num('start_date', t('contracts.startDate'), 'date')}
        {num('end_date', t('contracts.endDate'), 'date')}
        {num('min_days', t('contracts.minDays'))}
        {num('committed_brigades', t('contracts.committedBrigades'))}
        {num('security_deposit_paise', t('contracts.deposit'))}
        {num('notice_period_days', t('contracts.notice'))}
        <Field label={t('common.status')} htmlFor="ct-status">
          <Select id="ct-status" {...register('status')}>
            {Constants.public.Enums.contract_status.map((s) => <option key={s} value={s}>{t(`contractStatus.${s}`)}</option>)}
          </Select>
        </Field>
        <p className="self-end text-xs text-slate-500">{t('contracts.rateNote')}</p>
      </form>
    </Modal>
  )
}

export function ContractsDialog({ clientId, clientName, canEdit, onClose }: {
  clientId: string; clientName: string; canEdit: boolean; onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const qc = useQueryClient()
  const list = useContracts(clientId)
  const warehouses = useWarehouses()
  const [editing, setEditing] = useState<Contract | 'new' | null>(null)
  const whName = useMemo(() => new Map((warehouses.data ?? []).map((w) => [w.id, w.code])), [warehouses.data])

  const save = useMutation({
    mutationFn: async (v: ContractFormOutput) => {
      const res = editing && editing !== 'new'
        ? await supabase.from('contracts').update(v).eq('id', editing.id)
        : await supabase.from('contracts').insert({ ...v, client_id: clientId })
      if (res.error) throw res.error
    },
    onSuccess: () => { toast.success(t('common.saved')); setEditing(null); void qc.invalidateQueries({ queryKey: ['contracts'] }) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const columns = useMemo<ColumnDef<Contract>[]>(() => [
    { id: 'wh', header: t('common.warehouse'), accessorFn: (c) => whName.get(c.warehouse_id) ?? '' },
    { accessorKey: 'contract_no', header: t('contracts.contractNo'), cell: (c) => c.getValue<string | null>() ?? '—' },
    { id: 'period', header: t('contracts.period'), cell: ({ row: { original: c } }) => `${formatDate(c.start_date, lang)} → ${c.end_date ? formatDate(c.end_date, lang) : '…'}` },
    { accessorKey: 'committed_brigades', header: t('contracts.committedBrigades') },
    { accessorKey: 'security_deposit_paise', header: t('contracts.deposit'), cell: (c) => formatINR(c.getValue<number>(), lang) },
    { accessorKey: 'status', header: t('common.status'), cell: (c) => <Badge tone={TONE[c.getValue<Contract['status']>()]}>{t(`contractStatus.${c.getValue<string>()}`)}</Badge> },
    ...(canEdit ? [{ id: 'a', header: '', cell: ({ row }) => <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(row.original)}>{t('common.edit')}</Button> } satisfies ColumnDef<Contract>] : []),
  ], [t, lang, whName, canEdit])

  return (
    <>
      <Modal open size="lg" title={`${t('contracts.title')} — ${clientName}`} onClose={onClose}>
        {canEdit && (
          <div className="mb-3 flex justify-end">
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>{t('contracts.add')}</Button>
          </div>
        )}
        <DataTable data={list.data} columns={columns} loading={list.isPending} error={list.error ? t('common.error') : null}
          onRetry={() => list.refetch()} emptyMessage={t('contracts.empty')} pageSize={8} />
      </Modal>
      {editing && (
        <ContractForm
          initial={editing === 'new' ? emptyContract(warehouses.data?.length === 1 ? warehouses.data[0].id : '') : contractToForm(editing)}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => save.mutate(v)}
        />
      )}
    </>
  )
}
