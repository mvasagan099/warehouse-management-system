import { useQuery } from '@tanstack/react-query'
import type { Area } from '../auth/roles'
import { supabase } from './supabase'

export type FeatureKey = 'sensors' | 'qr' | 'coldChain'
export const FEATURE_AREAS: Record<FeatureKey, Area[]> = { sensors: ['sensors'], qr: ['labels', 'scan'], coldChain: ['coldChain'] }
export const FEATURE_KEYS = Object.keys(FEATURE_AREAS) as FeatureKey[]

/** Areas switched off in Settings. While the setting loads (or is missing) nothing is hidden. */
export function disabledAreas(flags: Partial<Record<FeatureKey, boolean>> | undefined): Set<Area> {
  const off = new Set<Area>()
  for (const k of FEATURE_KEYS) if (flags && flags[k] === false) FEATURE_AREAS[k].forEach((a) => off.add(a))
  return off
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['app_settings', 'features'], staleTime: 60_000,
    queryFn: async () => { const { data } = await supabase.from('app_settings').select('value').eq('key', 'features').maybeSingle(); return (data?.value ?? {}) as Partial<Record<FeatureKey, boolean>> },
  })
}
