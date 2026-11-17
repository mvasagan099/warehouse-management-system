import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { warehouseSchema, type WarehouseFormInput, type WarehouseFormOutput } from './schema'

export function WarehouseForm({
  open,
  title,
  initial,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  initial: WarehouseFormInput
  saving: boolean
  onClose: () => void
  onSubmit: (v: WarehouseFormOutput) => void
}) {
  const { t } = useTranslation()
  const { register, handleSubmit, formState: { errors }, watch } = useForm<WarehouseFormInput, unknown, WarehouseFormOutput>({
    resolver: zodResolver(warehouseSchema),
    values: initial,
  })
  const is24 = watch('is_24x7')

  const text = (name: keyof WarehouseFormInput, label: string, opts: { optional?: boolean; type?: string; hint?: string; inputMode?: 'decimal' | 'numeric' | 'tel' | 'email' } = {}) => (
    <Field label={label} htmlFor={`wh-${name}`} error={errors[name]?.message} optional={opts.optional} hint={opts.hint}>
      <Input id={`wh-${name}`} type={opts.type ?? 'text'} inputMode={opts.inputMode} aria-invalid={!!errors[name]} {...register(name)} />
    </Field>
  )

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" form="warehouse-form" loading={saving}>{t('common.save')}</Button>
        </>
      }
    >
      <form id="warehouse-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          {text('code', t('warehouses.code'), { optional: true, hint: t('warehouses.codeHelp') })}
          <div className="sm:col-span-2">{text('name', t('warehouses.name'))}</div>
        </div>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-slate-800">{t('warehouses.sectionAddress')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('address_line1', t('warehouses.address1'), { optional: true })}
            {text('address_line2', t('warehouses.address2'), { optional: true })}
            {text('city', t('warehouses.city'), { optional: true })}
            {text('district', t('warehouses.district'), { optional: true })}
            {text('state', t('warehouses.state'))}
            {text('pincode', t('warehouses.pincode'), { optional: true, inputMode: 'numeric' })}
            {text('latitude', t('warehouses.latitude'), { optional: true, inputMode: 'decimal' })}
            {text('longitude', t('warehouses.longitude'), { optional: true, inputMode: 'decimal' })}
            {text('total_area_sqft', t('warehouses.area'), { optional: true, inputMode: 'decimal' })}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-slate-800">{t('warehouses.sectionContact')}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {text('contact_name', t('warehouses.contactName'), { optional: true })}
            {text('contact_phone', t('warehouses.contactPhone'), { optional: true, type: 'tel', inputMode: 'tel' })}
            {text('contact_email', t('warehouses.contactEmail'), { optional: true, type: 'email', inputMode: 'email' })}
          </div>
          <Checkbox label={t('warehouses.is24x7')} {...register('is_24x7')} />
          {!is24 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {text('opens_at', t('warehouses.opensAt'), { optional: true, type: 'time' })}
              {text('closes_at', t('warehouses.closesAt'), { optional: true, type: 'time' })}
            </div>
          )}
          <Field label={t('warehouses.operatingNotes')} htmlFor="wh-notes" optional error={errors.operating_notes?.message}>
            <Textarea id="wh-notes" {...register('operating_notes')} />
          </Field>
        </fieldset>
      </form>
    </Modal>
  )
}
