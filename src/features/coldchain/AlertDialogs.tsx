import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { errorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { Alert } from '../../lib/types'
import { useEquipment } from './queries'

export const refreshAlerts = (qc: ReturnType<typeof useQueryClient>) => { for (const k of ['alerts', 'cc_overview', 'alert_detail', 'maintenance']) void qc.invalidateQueries({ queryKey: [k] }) }

export function useAcknowledge() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc('acknowledge_alert', { p_alert_id: id }); if (error) throw error },
    onSuccess: () => { toast.success(t('cold.acknowledged')); refreshAlerts(qc) },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
}

/** Resolve: the cause and the action taken are required; a machine fault can link equipment and create a maintenance task. */
export function ResolveDialog({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const equipment = useEquipment(alert.warehouse_id)
  const [cause, setCause] = useState('')
  const [action, setAction] = useState('')
  const [eq, setEq] = useState('')
  const [task, setTask] = useState(false)
  const [due, setDue] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resolve_alert', { p_alert_id: alert.id, p_cause: cause.trim(), p_action: action.trim(), p_equipment_id: eq || undefined, p_create_task: !!eq && task, p_task_due: due || undefined })
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('cold.resolved')); refreshAlerts(qc); onClose() },
    onError: async (e) => toast.error(await errorMessage(e)),
  })
  return (
    <Modal open title={t('cold.resolveTitle')} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={save.isPending} disabled={!cause.trim() || !action.trim()} onClick={() => save.mutate()}>{t('cold.resolve')}</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">{t('cold.resolveHelp')}</p>
        <Field label={t('cold.cause')} htmlFor="rs-cause"><Textarea id="rs-cause" value={cause} onChange={(e) => setCause(e.target.value)} /></Field>
        <Field label={t('cold.actionTaken')} htmlFor="rs-action"><Textarea id="rs-action" value={action} onChange={(e) => setAction(e.target.value)} /></Field>
        <Field label={t('cold.linkEquipment')} htmlFor="rs-eq" optional hint={t('cold.linkEquipmentHelp')}>
          <Select id="rs-eq" value={eq} onChange={(e) => setEq(e.target.value)}><option value="">{t('common.select')}</option>{(equipment.data ?? []).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</Select>
        </Field>
        {eq && <>
          <Checkbox label={t('cold.createTask')} checked={task} onChange={(e) => setTask(e.target.checked)} />
          {task && <Field label={t('cold.dueDate')} htmlFor="rs-due" optional><Input id="rs-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>}
        </>}
      </div>
    </Modal>
  )
}
