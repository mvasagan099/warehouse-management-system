import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { OverviewRow } from './common'

/** Re-render every `ms` so "last updated" ages and OFFLINE status never go stale on screen. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

/** Supabase Realtime: when a sensor reports or an alert changes, refresh the cold-chain queries without a page reload. */
export function useColdChainRealtime(enabled = true) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { for (const k of ['cc_overview', 'alerts', 'sensors', 'notifications', 'cc_series']) void qc.invalidateQueries({ queryKey: [k] }) }, 400) }
    const ch = supabase.channel(`cold-chain-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensors' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, refresh)
      .subscribe()
    return () => { clearTimeout(timer); void supabase.removeChannel(ch) }
  }, [qc, enabled])
}

export function useOverview(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['cc_overview', warehouseId], enabled: !!warehouseId, refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cold_chain_overview', { p_warehouse_id: warehouseId! })
      if (error) throw error
      return data as unknown as OverviewRow[]
    },
  })
}

export function useSensors(warehouseId?: string) {
  return useQuery({
    queryKey: ['sensors', warehouseId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('sensors').select('*').is('deleted_at', null).order('name')
      if (warehouseId) q = q.eq('warehouse_id', warehouseId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useAlerts(opts: { warehouseId?: string; open?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: ['alerts', opts.warehouseId ?? 'all', !!opts.open, opts.limit ?? 200],
    queryFn: async () => {
      let q = supabase.from('alerts').select('*').order('opened_at', { ascending: false }).limit(opts.limit ?? 200)
      if (opts.warehouseId) q = q.eq('warehouse_id', opts.warehouseId)
      if (opts.open) q = q.neq('status', 'RESOLVED')
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useEquipment(warehouseId?: string) {
  return useQuery({
    queryKey: ['equipment', warehouseId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('equipment').select('*').is('deleted_at', null).order('name')
      if (warehouseId) q = q.eq('warehouse_id', warehouseId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'], refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
      if (error) throw error
      return data
    },
  })
}

/** The warehouse a person is looking at (remembered on this device). */
export function useWarehouseChoice(ids: string[]): [string | undefined, (id: string) => void] {
  const [id, setId] = useState<string | undefined>(() => { try { return localStorage.getItem('wms.cc.wh') ?? undefined } catch { return undefined } })
  const valid = id && ids.includes(id) ? id : ids[0]
  return [valid, (v) => { setId(v); try { localStorage.setItem('wms.cc.wh', v) } catch { /* ignore */ } }]
}
