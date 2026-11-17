import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// RLS decides which rows come back; the UI never filters for security.

export const qk = {
  clients: ['clients'] as const,
  companies: (clientId?: string) => ['companies', clientId ?? 'all'] as const,
  contracts: (clientId?: string) => ['contracts', clientId ?? 'all'] as const,
  settings: ['app_settings'] as const,
  warehouses: ['warehouses'] as const,
  zones: (warehouseId?: string) => ['zones', warehouseId ?? 'all'] as const,
  brigadeTypes: ['brigade_types'] as const,
  summary: ['v_zone_slot_summary'] as const,
}

export function useWarehouses() {
  return useQuery({
    queryKey: qk.warehouses,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .is('deleted_at', null)
        .order('code')
      if (error) throw error
      return data
    },
  })
}

export function useZones(warehouseId?: string) {
  return useQuery({
    queryKey: qk.zones(warehouseId),
    queryFn: async () => {
      let q = supabase.from('zones').select('*').is('deleted_at', null).order('code')
      if (warehouseId) q = q.eq('warehouse_id', warehouseId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useBrigadeTypes() {
  return useQuery({
    queryKey: qk.brigadeTypes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brigade_types')
        .select('*')
        .is('deleted_at', null)
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useSlotSummary() {
  return useQuery({
    queryKey: qk.summary,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_zone_slot_summary')
        .select('*')
        .order('warehouse_code')
        .order('zone_code')
      if (error) throw error
      return data
    },
  })
}

export function useClients() {
  return useQuery({
    queryKey: qk.clients,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').is('deleted_at', null).order('company_name')
      if (error) throw error
      return data
    },
  })
}

export function useCompanies(clientId?: string) {
  return useQuery({
    queryKey: qk.companies(clientId),
    enabled: clientId !== '',
    queryFn: async () => {
      let q = supabase.from('company_master').select('*').is('deleted_at', null).eq('is_active', true).order('name')
      if (clientId) q = q.eq('client_id', clientId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useContracts(clientId?: string) {
  return useQuery({
    queryKey: qk.contracts(clientId),
    queryFn: async () => {
      let q = supabase.from('contracts').select('*').is('deleted_at', null).order('start_date', { ascending: false })
      if (clientId) q = q.eq('client_id', clientId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

/** Setting values live in the app_settings table (staff, managers and admins can read them). */
export function useSetting<T>(key: string, fallback: T) {
  return useQuery({
    queryKey: [...qk.settings, key],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
      if (error) throw error
      return (data?.value as T | undefined) ?? fallback
    },
  })
}
