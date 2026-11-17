import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Wand2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthProvider'
import { creatableRoles } from '../../auth/roles'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { useWarehouses } from '../shared/queries'
import { createUserSchema, generateTempPassword, type CreateUserInput, type CreateUserOutput } from './schema'

export function CreateUserDialog({
  initial,
  applicantId,
  title,
  onClose,
  onCreated,
}: {
  initial?: Partial<CreateUserInput>
  applicantId?: string
  title: string
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const { profile, warehouseScope } = useAuth()
  const warehouses = useWarehouses()
  const roles = creatableRoles(profile?.role)
  const choices = (warehouses.data ?? []).filter((w) => w.is_active && (warehouseScope === null || warehouseScope.includes(w.id)))

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<CreateUserInput, unknown, CreateUserOutput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      role: roles.includes('STAFF') && roles.length === 1 ? 'STAFF' : 'WAREHOUSE_MANAGER',
      password: generateTempPassword(),
      warehouse_ids: choices.length === 1 ? [choices[0].id] : [],
      ...initial,
    },
  })
  const role = watch('role')

  const create = useMutation({
    mutationFn: async (v: CreateUserOutput) => {
      // Runs server-side with the service key; the browser only sends its own JWT.
      const { error } = await supabase.functions.invoke('create-user', {
        body: { ...v, applicant_id: applicantId ?? null },
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t('users.created'))
      onCreated()
    },
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" form="create-user-form" loading={create.isPending}>{t('common.create')}</Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit((v) => create.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('users.fullName')} htmlFor="cu-name" error={errors.full_name?.message} className="sm:col-span-2">
          <Input id="cu-name" {...register('full_name')} />
        </Field>
        <Field label={t('common.email')} htmlFor="cu-email" error={errors.email?.message}>
          <Input id="cu-email" type="email" autoComplete="off" {...register('email')} />
        </Field>
        <Field label={t('common.phone')} htmlFor="cu-phone" optional error={errors.phone?.message}>
          <Input id="cu-phone" type="tel" {...register('phone')} />
        </Field>
        <Field label={t('common.role')} htmlFor="cu-role" error={errors.role?.message}>
          <Select
            id="cu-role"
            {...register('role', {
              onChange: (e) => {
                if (e.target.value === 'STAFF') setValue('warehouse_ids', watch('warehouse_ids').slice(0, 1))
                if (e.target.value === 'ACCOUNTANT') setValue('warehouse_ids', [])
              },
            })}
          >
            {roles.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('users.password')} htmlFor="cu-pass" hint={t('users.tempPasswordHelp')} error={errors.password?.message}>
          <div className="flex gap-2">
            <Input id="cu-pass" autoComplete="new-password" className="font-mono" {...register('password')} />
            <Button variant="secondary" size="sm" aria-label="Generate" onClick={() => setValue('password', generateTempPassword())} icon={<Wand2 className="h-4 w-4" />} />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="warehouse_ids"
            render={({ field }) =>
              role === 'ACCOUNTANT' ? (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t('users.accountantHelp')}</p>
              ) : role === 'STAFF' ? (
                <Field label={t('common.warehouse')} htmlFor="cu-wh" error={errors.warehouse_ids?.message}>
                  <Select id="cu-wh" value={field.value[0] ?? ''} onChange={(e) => field.onChange(e.target.value ? [e.target.value] : [])}>
                    <option value="">{t('common.select')}</option>
                    {choices.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
                  </Select>
                </Field>
              ) : (
                <fieldset>
                  <legend className="mb-1 text-sm font-medium text-slate-700">{t('users.warehouses')}</legend>
                  <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                    {choices.map((w) => (
                      <Checkbox
                        key={w.id}
                        label={`${w.code} · ${w.name}`}
                        checked={field.value.includes(w.id)}
                        onChange={(e) => field.onChange(e.target.checked ? [...field.value, w.id] : field.value.filter((x) => x !== w.id))}
                      />
                    ))}
                  </div>
                  {errors.warehouse_ids?.message && <p className="mt-1 text-xs text-red-600" role="alert">{t(errors.warehouse_ids.message)}</p>}
                </fieldset>
              )
            }
          />
        </div>
      </form>
    </Modal>
  )
}
