import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { useWarehouses } from '../shared/queries'

/** Administrator: which warehouses a client belongs to. Managers and staff see only the clients of their own warehouse. */
export function ClientWarehousesDialog({ clientId, clientName, onClose }: { clientId: string; clientName: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const whs = useWarehouses()
  const linked = useQuery({ queryKey: ['client_warehouses', clientId], queryFn: async () => { const { data, error } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: { warehouse_id: string }[] | null; error: Error | null }> } } }).from('client_warehouses').select('warehouse_id').eq('client_id', clientId); if (error) throw error; return (data ?? []).map((r) => r.warehouse_id) } })
  const [sel, setSel] = useState<string[] | null>(null)
  const chosen = sel ?? linked.data ?? []
  const save = useMutation({
    mutationFn: async () => { const { error } = await (supabase as unknown as { rpc: (fn: string, a: object) => Promise<{ error: { message: string } | null }> }).rpc('set_client_warehouses', { p_client_id: clientId, p_warehouse_ids: chosen }); if (error) throw error },
    onSuccess: () => { toast.success(t('common.saved')); void qc.invalidateQueries({ queryKey: ['client_warehouses'] }); onClose() }, onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('clients.warehousesTitle', { name: clientName })} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></>}>
      <p className="mb-3 text-sm text-slate-600">{t('clients.warehousesHelp')}</p>
      {linked.isPending ? <Spinner /> : <div className="space-y-1">{(whs.data ?? []).filter((w) => w.is_active).map((w) => (
        <Checkbox key={w.id} label={`${w.code} · ${w.name}`} checked={chosen.includes(w.id)} onChange={(e) => setSel(e.target.checked ? [...chosen, w.id] : chosen.filter((x) => x !== w.id))} />))}</div>}
    </Modal>
  )
}
