import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '../components/ui/Spinner'
import { MessagePage } from '../pages/MessagePage'
import { useAuth } from './AuthProvider'
import { disabledAreas, useFeatureFlags } from '../lib/features'
import { canAccess, type Area } from './roles'

/** Requires a signed-in, active, non-client user. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile || !profile.is_active || profile.deleted_at)
    return <MessagePage titleKey="auth.inactiveTitle" bodyKey="auth.inactiveBody" showLogout />
  // A CLIENT login must be linked to a client company, otherwise there is nothing to show.
  if (profile.role === 'CLIENT' && !profile.client_id)
    return <MessagePage titleKey="auth.noAccessTitle" bodyKey="auth.noAccessBody" showLogout />
  if (profile.must_change_password && location.pathname !== '/account/password')
    return <Navigate to="/account/password" replace />
  return children ? <>{children}</> : <Outlet />
}

/** Requires the current role to have access to an area (see roles.ts). */
export function RequireArea({ area, children }: { area: Area; children: ReactNode }) {
  const { profile } = useAuth()
  const flags = useFeatureFlags()
  if (disabledAreas(flags.data).has(area))
    return <MessagePage titleKey="features.offTitle" bodyKey="features.offBody" />
  if (!canAccess(profile?.role, area))
    return <MessagePage titleKey="auth.forbiddenTitle" bodyKey="auth.forbiddenBody" />
  return <>{children}</>
}
