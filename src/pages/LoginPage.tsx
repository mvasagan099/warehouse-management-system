import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { loginSchema, type LoginValues } from '../auth/schemas'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { supabase } from '../lib/supabase'
import { AuthShell } from './AuthShell'

export function LoginPage() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [authError, setAuthError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (!loading && session) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async (values) => {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      setAuthError(t('auth.invalidCredentials'))
      return
    }
    const from = (location.state as { from?: string } | null)?.from
    navigate(from && from !== '/login' ? from : '/', { replace: true })
  })

  return (
    <AuthShell title={t('auth.loginTitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t('auth.email')} htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" aria-invalid={!!formState.errors.email} {...register('email')} />
        </Field>
        <Field label={t('auth.password')} htmlFor="password" error={formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register('password')} />
        </Field>
        {authError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{authError}</p>}
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          {formState.isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
        <div className="text-center">
          <Link to="/forgot-password" className="text-sm text-brand-700 hover:underline">{t('auth.forgot')}</Link>
        </div>
      </form>
    </AuthShell>
  )
}
