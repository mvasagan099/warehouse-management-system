import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { newPasswordSchema } from '../auth/schemas'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { FullPageSpinner } from '../components/ui/Spinner'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { AuthShell } from './AuthShell'

/** Landing page for the password-recovery email link. */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, loading, refreshProfile } = useAuth()
  const { register, handleSubmit, formState } = useForm<z.input<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  if (loading) return <FullPageSpinner />

  const onSubmit = handleSubmit(async ({ password }) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return void toast.error(await errorMessage(error))
    if (session) await supabase.from('profiles').update({ must_change_password: false }).eq('id', session.user.id)
    await refreshProfile()
    toast.success(t('auth.passwordUpdated'))
    navigate('/', { replace: true })
  })

  return (
    <AuthShell title={t('auth.resetTitle')}>
      {!session ? (
        <p className="text-sm text-red-700" role="alert">{t('auth.recoveryMissing')}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t('auth.newPassword')} htmlFor="password" error={formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          </Field>
          <Field label={t('auth.confirmPassword')} htmlFor="confirm" error={formState.errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>{t('auth.setPassword')}</Button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm text-brand-700 hover:underline">{t('auth.backToLogin')}</Link>
      </div>
    </AuthShell>
  )
}
