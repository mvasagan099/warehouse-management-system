import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// RLS decides which rows come back; the UI never filters for security.

export const qk = {
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
