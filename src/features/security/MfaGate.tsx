import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthProvider'
import { FullPageSpinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import { AuthShell } from '../../pages/AuthShell'
import { MfaPanel } from './MfaScreen'

interface SecState { mfa_required: boolean; aal: string; role: string | null }

/** When two-factor is switched on, an administrator who has not passed it sees only this screen. */
export function MfaGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  if (profile?.role !== 'SUPER_ADMIN') return <>{children}</>
  return <AdminMfaGate>{children}</AdminMfaGate>
}

function AdminMfaGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const q = useQuery({
    queryKey: ['security_state', profile?.id],
    queryFn: async () => { const { data, error } = await supabase.rpc('my_security_state'); if (error) throw error; return data as unknown as SecState },
  })
  if (q.isPending) return <FullPageSpinner />
  if (q.data?.mfa_required && q.data.aal !== 'aal2') {
    return (
      <AuthShell title={t('mfa.title')}>
        <div className="space-y-4"><p className="flex items-center gap-2 text-sm text-slate-600"><ShieldCheck className="h-5 w-5 text-brand-700" />{t('mfa.required')}</p>
          <MfaPanel onVerified={() => void q.refetch()} />
          <button className="text-sm text-brand-700 underline" onClick={() => signOut()}>{t('header.logout')}</button></div>
      </AuthShell>)
  }
  return <>{children}</>
}
