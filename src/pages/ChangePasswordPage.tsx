import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { changePasswordSchema } from '../auth/schemas'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Card, PageHeader } from '../components/ui/misc'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

export function ChangePasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const { register, handleSubmit, formState, setError, reset } = useForm<z.input<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: '', password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async ({ current, password }) => {
    if (!profile) return
    // re-authenticate with the current password first
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: profile.email, password: current })
    if (reauthError) return setError('current', { message: 'auth.wrongCurrent' })
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return void toast.error(await errorMessage(error))
    if (profile.must_change_password) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile.id)
      await refreshProfile()
    }
    reset()
    toast.success(t('auth.passwordUpdated'))
    navigate('/', { replace: true })
  })

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={t('auth.changeTitle')} />
      {profile?.must_change_password && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">{t('auth.mustChange')}</p>
      )}
      <Card className="p-5">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t('auth.currentPassword')} htmlFor="current" error={formState.errors.current?.message}>
            <Input id="current" type="password" autoComplete="current-password" {...register('current')} />
          </Field>
          <Field label={t('auth.newPassword')} htmlFor="password" error={formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          </Field>
          <Field label={t('auth.confirmPassword')} htmlFor="confirm" error={formState.errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
          </Field>
          <Button type="submit" loading={formState.isSubmitting}>{t('auth.setPassword')}</Button>
        </form>
      </Card>
    </div>
  )
}
