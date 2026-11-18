import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { errorMessage } from '../../lib/errors'
import { isNetworkError } from '../../lib/offline/queue'
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue'
import { supabase } from '../../lib/supabase'
import type { GateEntryLine } from '../../lib/types'

/** Quantity counted at the dock. Works with no signal (saved on the phone); if someone else counted this line meanwhile, the sync asks instead of overwriting. */
export function CountCell({ line, onSaved }: { line: GateEntryLine; onSaved: () => void }) {
  const { t } = useTranslation()
  const q = useOfflineQueue()
  const [v, setV] = useState(line.counted_qty === null ? '' : String(line.counted_qty))
  const [busy, setBusy] = useState(false)
  const waiting = q.items.some((i) => i.kind === 'count' && (i.payload as { line_id?: string }).line_id === line.id)
  const num = v.trim() === '' ? null : Number(v)
  const valid = num !== null && Number.isFinite(num) && num >= 0
  const save = async () => {
    if (!valid) return
    setBusy(true)
    const queue = async () => { await q.enqueue('count', `${line.item_name}: ${num}`, { line_id: line.id, counted_qty: num }, { baseUpdatedAt: line.updated_at }); toast.info(t('offline.savedOnPhone')) }
    try {
      if (!navigator.onLine) return await queue()
      const { data, error } = await supabase.from('gate_entry_lines').update({ counted_qty: num }).eq('id', line.id).eq('updated_at', line.updated_at).select('id')
      if (error) { if (isNetworkError(error)) return await queue(); throw error }
      if (!data?.length) { toast.warning(t('offline.changedMeanwhile')); onSaved(); return }
      toast.success(t('common.saved')); onSaved()
    } catch (e) { toast.error(await errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-1">
      <Input aria-label={`${t('gate.counted')} ${line.item_name}`} type="number" inputMode="decimal" min={0} step="any" value={v} onChange={(e) => setV(e.target.value)} className="w-24 py-1" />
      <Button size="sm" variant="secondary" disabled={!valid || String(line.counted_qty ?? '') === v} loading={busy} onClick={save}>{t('common.save')}</Button>
      {waiting && <span className="text-xs text-amber-700">{t('offline.waiting')}</span>}
    </div>
  )
}
