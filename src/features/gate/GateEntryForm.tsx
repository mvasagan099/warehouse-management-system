import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useClients, useCompanies, useWarehouses } from '../shared/queries'
import { QuickClient, QuickCompany } from './QuickAdd'
import { gateEntrySchema, type GateFormInput, type GateFormOutput } from './schema'

/** Mobile-first: the few fields staff need at the gate are big and first; the rest sit under "more details". */
export function GateEntryForm({ initial, saving, onClose, onSubmit }: {
  initial: GateFormInput; saving: boolean; onClose: () => void; onSubmit: (v: GateFormOutput) => void
}) {
  const { t } = useTranslation()
  const clients = useClients()
  const warehouses = useWarehouses()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<GateFormInput, unknown, GateFormOutput>({
    resolver: zodResolver(gateEntrySchema), defaultValues: initial,
  })
  const clientId = watch('client_id')
  const companies = useCompanies(clientId || '')
  const inward = initial.direction === 'INWARD'
  const [adding, setAdding] = useState<'client' | 'company' | null>(null)
  const big = 'h-12 text-base'
  const f = (name: keyof GateFormInput, label: string, opts: { optional?: boolean; type?: string; mode?: 'decimal' | 'numeric' | 'tel'; className?: string } = {}) => (
    <Field label={label} htmlFor={`ge-${name}`} error={errors[name]?.message} optional={opts.optional}>
      <Input id={`ge-${name}`} type={opts.type ?? 'text'} inputMode={opts.mode} className={opts.className} aria-invalid={!!errors[name]} {...register(name)} />
    </Field>
  )
  return (
    <Modal open size="lg" title={inward ? t('gate.addInward') : t('gate.addOutward')} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="gate-form" loading={saving} className="h-11 px-6 text-base">{t('gate.record')}</Button>
      </>
    }>
      <form id="gate-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <input type="hidden" {...register('direction')} />
        <div className="grid gap-4 sm:grid-cols-2">
          {(warehouses.data?.filter((w) => w.is_active).length ?? 0) > 1 ? (
            <Field label={t('common.warehouse')} htmlFor="ge-warehouse_id" error={errors.warehouse_id?.message} className="sm:col-span-2">
              <Select id="ge-warehouse_id" className={big} {...register('warehouse_id')}>
                <option value="">{t('common.select')}</option>
                {warehouses.data?.filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
              </Select>
            </Field>
          ) : (
            <input type="hidden" {...register('warehouse_id')} />
          )}
          <Field label={t('common.client')} htmlFor="ge-client_id" error={errors.client_id?.message}>
            <Select id="ge-client_id" className={big} {...register('client_id')}>
              <option value="">{t('common.select')}</option>
              {clients.data?.filter((c) => c.status === 'ACTIVE').map((c) => <option key={c.id} value={c.id}>{c.code} · {c.company_name}</option>)}
            </Select>
            <button type="button" className="mt-1 text-sm font-medium text-brand-700 hover:underline" onClick={() => setAdding('client')}>+ {t('gate.newClient')}</button>
          </Field>
          <Field label={inward ? t('gate.fromCompany') : t('gate.toCompany')} htmlFor="ge-company_id" optional error={errors.company_id?.message}>
            <Select id="ge-company_id" className={big} {...register('company_id')}>
              <option value="">{t('common.select')}</option>
              {companies.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {clientId && <button type="button" className="mt-1 text-sm font-medium text-brand-700 hover:underline" onClick={() => setAdding('company')}>+ {t('gate.newCompany')}</button>}
          </Field>
          {f('lorry_number', t('gate.lorryNumber'), { className: `${big} uppercase font-mono` })}
          {f('driver_name', t('gate.driverName'), { optional: true, className: big })}
          {f('driver_phone', t('gate.driverPhone'), { optional: true, type: 'tel', mode: 'tel', className: big })}
          {f('lorry_temp_c', t('gate.lorryTemp'), { optional: true, mode: 'decimal', className: big })}
          {f('seal_number_arrival', t('gate.sealArrival'), { optional: true, className: big })}
          {f('eway_bill_number', t('gate.ewayBill'), { optional: true, mode: 'numeric', className: big })}
        </div>
        <details className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium">{t('gate.moreDetails')}</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {f('lorry_type', t('gate.lorryType'), { optional: true })}
            {f('capacity_tonnes', t('gate.capacity'), { optional: true, mode: 'decimal' })}
            {f('driver_licence_no', t('gate.licence'), { optional: true })}
            {f('transporter_name', t('gate.transporter'), { optional: true })}
            {f('lr_number', t('gate.lrNumber'), { optional: true })}
            {f('invoice_number', t('gate.invoiceNumber'), { optional: true })}
            {f('eway_valid_until', t('gate.ewayValid'), { optional: true, type: 'datetime-local' })}
            <Field label={t('common.notes')} htmlFor="ge-remarks" optional className="sm:col-span-2"><Textarea id="ge-remarks" {...register('remarks')} /></Field>
          </div>
        </details>
      </form>
      {adding === 'client' && <QuickClient onClose={() => setAdding(null)} onCreated={(id) => { setValue('client_id', id); setAdding(null) }} />}
      {adding === 'company' && clientId && <QuickCompany clientId={clientId} onClose={() => setAdding(null)} onCreated={(id) => { setValue('company_id', id); setAdding(null) }} />}
    </Modal>
  )
}
