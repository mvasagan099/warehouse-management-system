import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { z } from 'zod'
import { forgotSchema } from '../auth/schemas'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { supabase } from '../lib/supabase'
import { AuthShell } from './AuthShell'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    // Always show the same message so the form cannot be used to discover accounts.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    setSent(true)
  })

  return (
    <AuthShell title={t('auth.forgotTitle')}>
      {sent ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{t('auth.linkSent')}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <p className="text-sm text-slate-600">{t('auth.forgotHelp')}</p>
          <Field label={t('auth.email')} htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="username" {...register('email')} />
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>{t('auth.sendLink')}</Button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm text-brand-700 hover:underline">{t('auth.backToLogin')}</Link>
      </div>
    </AuthShell>
  )
}
