import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { canAccess } from '../../auth/roles'
import { supabase } from '../../lib/supabase'

/**
 * A thin rail across the very top of every screen that says, without words, how the cold rooms are doing:
 * cobalt = all calm, amber = an open warning, red = an open critical alert (it breathes slowly so it is noticed).
 * It is a link to the alerts page for the people who handle alerts.
 */
export function StatusRail() {
  const { profile } = useAuth()
  const allowed = !!profile && canAccess(profile.role, 'alerts')
  const q = useQuery({
    queryKey: ['status_rail'], enabled: allowed, refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('alerts').select('severity').is('recovered_at', null).neq('status', 'RESOLVED').limit(50)
      if (error) throw error
      return { critical: data.some((a) => a.severity === 'CRITICAL'), open: data.length }
    },
  })
  const tone = q.data?.critical ? 'bg-[#c93a2e]' : q.data?.open ? 'bg-[#e8a317]' : 'bg-brand-600'
  const bar = <div className={`h-1 w-full ${tone}`} style={q.data?.critical ? { animation: 'rail-pulse 2.4s ease-in-out infinite' } : undefined} />
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50" aria-hidden={!q.data?.open}>
      {q.data?.open ? <Link to="/alerts" className="pointer-events-auto block" aria-label={`${q.data.open} open alerts`}>{bar}</Link> : bar}
    </div>
  )
}
