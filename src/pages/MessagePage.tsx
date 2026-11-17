import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'

export function MessagePage({ titleKey, bodyKey, showLogout }: { titleKey: string; bodyKey?: string; showLogout?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldAlert className="h-10 w-10 text-slate-400" aria-hidden />
      <h1 className="text-xl font-semibold">{t(titleKey)}</h1>
      {bodyKey && <p className="max-w-md text-sm text-slate-600">{t(bodyKey)}</p>}
      {showLogout ? (
        <Button variant="secondary" onClick={() => supabase.auth.signOut()}>{t('header.logout')}</Button>
      ) : (
        <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">{t('nav.dashboard')}</Link>
      )}
    </div>
  )
}
