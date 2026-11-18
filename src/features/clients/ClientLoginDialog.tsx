import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Wand2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { strongPassword } from '../../lib/password'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { optionalPhone, requiredText } from '../../lib/zod'
import { generateTempPassword } from '../users/schema'

const schema = z.object({
  full_name: requiredText(150),
  email: z.string().trim().min(1, 'validation.required').pipe(z.email('validation.email')).transform((v) => v.toLowerCase()),
  phone: optionalPhone,
  password: strongPassword,
})
type In = z.input<typeof schema>
type Out = z.output<typeof schema>

/** Creates a CLIENT login linked to a client, through the create-user Edge Function (service key stays server-side). */
export function ClientLoginDialog({ clientId, clientName, defaults, onClose }: {
  clientId: string; clientName: string; defaults?: Partial<In>; onClose: () => void
}) {
  const { t } = useTranslation()
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', phone: '', password: generateTempPassword(), ...defaults },
  })
  const create = useMutation({
    mutationFn: async (v: Out) => {
      const { error } = await supabase.functions.invoke('create-user', {
        body: { ...v, role: 'CLIENT', client_id: clientId, warehouse_ids: [] },
      })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('users.created')); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={`${t('clients.createLogin')} — ${clientName}`} onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" form="client-login-form" loading={create.isPending}>{t('common.create')}</Button>
      </>
    }>
      <form id="client-login-form" onSubmit={handleSubmit((v) => create.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('users.fullName')} htmlFor="cl-name" error={errors.full_name?.message} className="sm:col-span-2">
          <Input id="cl-name" {...register('full_name')} />
        </Field>
        <Field label={t('common.email')} htmlFor="cl-email" error={errors.email?.message}>
          <Input id="cl-email" type="email" autoComplete="off" {...register('email')} />
        </Field>
        <Field label={t('common.phone')} htmlFor="cl-phone" optional error={errors.phone?.message}>
          <Input id="cl-phone" type="tel" {...register('phone')} />
        </Field>
        <Field label={t('users.password')} htmlFor="cl-pass" hint={t('users.tempPasswordHelp')} error={errors.password?.message} className="sm:col-span-2">
          <div className="flex gap-2">
            <Input id="cl-pass" autoComplete="new-password" className="font-mono" {...register('password')} />
            <Button variant="secondary" size="sm" aria-label="Generate" onClick={() => setValue('password', generateTempPassword())} icon={<Wand2 className="h-4 w-4" />} />
          </div>
        </Field>
      </form>
    </Modal>
  )
}
