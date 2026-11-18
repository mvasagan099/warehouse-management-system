import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, UserPlus, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

/** Administrator: who manages this warehouse. Removing the last manager asks for confirmation and says why. */
export function ManagersDialog({ warehouseId, warehouseName, onClose }: { warehouseId: string; warehouseName: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [pick, setPick] = useState('')
  const [warn, setWarn] = useState<string | null>(null)
  const data = useQuery({
    queryKey: ['wh_managers', warehouseId],
    queryFn: async () => {
      const [assigned, all] = await Promise.all([
        supabase.from('warehouse_managers').select('user_id').eq('warehouse_id', warehouseId).is('deleted_at', null),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'WAREHOUSE_MANAGER').eq('is_active', true).is('deleted_at', null).order('full_name'),
      ])
      if (assigned.error) throw assigned.error
      if (all.error) throw all.error
      const ids = new Set(assigned.data.map((a) => a.user_id))
      return { assigned: all.data.filter((p) => ids.has(p.id)), available: all.data.filter((p) => !ids.has(p.id)) }
    },
  })
  const refresh = () => { void data.refetch(); void qc.invalidateQueries({ queryKey: ['users'] }); void qc.invalidateQueries({ queryKey: ['admin_dashboard'] }) }
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc('assign_manager', { p_user_id: pick, p_warehouse_id: warehouseId }); if (error) throw error },
    onSuccess: () => { setPick(''); refresh() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: async ({ userId, confirm }: { userId: string; confirm: boolean }) => {
      const { data: r, error } = await supabase.rpc('remove_manager', { p_user_id: userId, p_warehouse_id: warehouseId, p_confirm: confirm })
      if (error) throw error
      return { userId, result: r as { removed: boolean; warning: string | null } }
    },
    onSuccess: ({ userId, result }) => { if (!result.removed && result.warning === 'NO_MANAGER_LEFT') setWarn(userId); else { setWarn(null); toast.success(t('managers.removed')); refresh() } },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('managers.title', { name: warehouseName })} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {data.data && data.data.assigned.length === 0 && <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-800" role="alert"><AlertTriangle className="h-4 w-4 shrink-0" />{t('managers.none')}</p>}
        <ul className="divide-y divide-slate-100">{(data.data?.assigned ?? []).map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-2"><span><span className="font-medium">{m.full_name}</span> <span className="text-slate-500">{m.email}</span></span>
            <Button size="sm" variant="ghost" icon={<UserMinus className="h-4 w-4" />} onClick={() => remove.mutate({ userId: m.id, confirm: false })}>{t('managers.remove')}</Button></li>))}</ul>
        {warn && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800" role="alert"><p className="mb-2 font-medium">{t('managers.lastWarning')}</p>
          <div className="flex gap-2"><Button size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate({ userId: warn, confirm: true })}>{t('managers.removeAnyway')}</Button><Button size="sm" variant="secondary" onClick={() => setWarn(null)}>{t('common.cancel')}</Button></div></div>}
        <div className="flex gap-2"><Select aria-label={t('managers.pick')} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">{t('managers.pick')}</option>{(data.data?.available ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</Select>
          <Button icon={<UserPlus className="h-4 w-4" />} disabled={!pick} loading={add.isPending} onClick={() => add.mutate()}>{t('managers.assign')}</Button></div>
      </div>
    </Modal>
  )
}
