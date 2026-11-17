import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

export interface AuthState {
  session: Session | null
  profile: Profile | null
  /** warehouse ids this user may see: managed (manager) or own (staff); null = all (admin) */
  warehouseScope: string[] | null
  loading: boolean
  /** true right after following a password-recovery email link */
  recovery: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function loadProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  let scope: string[] | null = null
  if (data?.role === 'WAREHOUSE_MANAGER') {
    const { data: wm, error: wmErr } = await supabase
      .from('warehouse_managers')
      .select('warehouse_id')
      .eq('user_id', userId)
      .is('deleted_at', null)
    if (wmErr) throw wmErr
    scope = (wm ?? []).map((r) => r.warehouse_id)
  } else if (data?.role === 'STAFF') {
    scope = data.warehouse_id ? [data.warehouse_id] : []
  } else if (data?.role === 'CLIENT') {
    scope = []
  }
  return { profile: data, scope }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        setRecovery(false)
        queryClient.clear()
      }
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['me', userId],
    queryFn: () => loadProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile: profileQuery.data?.profile ?? null,
      warehouseScope: profileQuery.data?.scope ?? null,
      loading: sessionLoading || (!!userId && profileQuery.isPending),
      recovery,
      signOut: async () => {
        await supabase.auth.signOut()
      },
      refreshProfile: async () => {
        await queryClient.invalidateQueries({ queryKey: ['me'] })
      },
    }),
    [session, profileQuery.data, profileQuery.isPending, sessionLoading, userId, recovery, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export { AuthContext }
