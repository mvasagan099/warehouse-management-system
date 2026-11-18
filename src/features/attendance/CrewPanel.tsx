import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

/**
 * Which workers handled this lorry. For reports only: it never changes what a client is billed.
 * Staff who were checked in at the time are listed first and ticked by default when nothing has been saved yet.
 */
export function CrewPanel({ documentType, documentId, warehouseId, at, editable }: { documentType: 'INWARD_RECEIPT' | 'DELIVERY_CHALLAN'; documentId: string; warehouseId: string; at: string; editable: boolean }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const people = useQuery({
    queryKey: ['crew_people', warehouseId],
    queryFn: async () => { const { data, error } = await supabase.from('profiles').select('id, full_name, role').eq('warehouse_id', warehouseId).eq('is_active', true).order('full_name'); if (error) throw error; return data },
  })
  const saved = useQuery({
    queryKey: ['crew', documentType, documentId],
    queryFn: async () => { const { data, error } = await supabase.from('crew_log').select('user_id').eq('document_type', documentType).eq('document_id', documentId); if (error) throw error; return data.map((r) => r.user_id) },
  })
  const duty = useQuery({
    queryKey: ['on_duty', warehouseId, at],
    queryFn: async () => { const { data, error } = await supabase.rpc('on_duty_at', { p_warehouse_id: warehouseId, p_at: at }); if (error) throw error; return data.map((r) => r.user_id) },
  })
  const [sel, setSel] = useState<string[] | null>(null)
  useEffect(() => { if (saved.data && !sel) setSel(saved.data) }, [saved.data, sel])
  const chosen = sel ?? saved.data ?? []
  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc('set_crew', { p_document_type: documentType, p_document_id: documentId, p_user_ids: chosen }); if (error) throw error },
    onSuccess: () => { toast.success(t('crew.saved')); void qc.invalidateQueries({ queryKey: ['crew'] }) }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const onDuty = new Set(duty.data ?? [])
  const sorted = [...(people.data ?? [])].sort((a, b) => Number(onDuty.has(b.id)) - Number(onDuty.has(a.id)))
  return (
    <Card className="p-4">
      <h3 className="mb-1 text-sm font-semibold">{t('crew.title')}</h3>
      <p className="mb-3 text-xs text-slate-500">{t('crew.help')}</p>
      <ul className="grid gap-1 sm:grid-cols-2">{sorted.map((p) => (
        <li key={p.id}><label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
          <input type="checkbox" className="h-4 w-4" disabled={!editable} checked={chosen.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id))} />
          <span>{p.full_name}</span>{onDuty.has(p.id) && <span className="rounded-full bg-emerald-50 px-2 text-xs text-emerald-700">{t('crew.onDuty')}</span>}</label></li>))}
        {!sorted.length && <li className="text-sm text-slate-500">{t('crew.noStaff')}</li>}</ul>
      {editable && <div className="mt-3"><Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></div>}
    </Card>
  )
}
