import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { Card, PageHeader, Toolbar } from '../../components/ui/misc'
import { Spinner } from '../../components/ui/Spinner'
import type { Alert } from '../../lib/types'
import { downloadText, toCsv } from '../billing/common'
import { useWarehouses, useZones } from '../shared/queries'
import { AlertDetail, AlertRows } from './AlertsView'
import { useAlerts, useColdChainRealtime } from './queries'

export function AlertsPage() {
  const { t } = useTranslation()
  useColdChainRealtime()
  const whs = useWarehouses()
  const zones = useZones()
  const [wh, setWh] = useState('')
  const [view, setView] = useState<'open' | 'all'>('open')
  const [selected, setSelected] = useState<Alert | null>(null)
  const alerts = useAlerts({ warehouseId: wh || undefined, open: view === 'open' })
  const zone = useMemo(() => new Map((zones.data ?? []).map((z) => [z.id, z.code])), [zones.data])
  const csv = () => downloadText('alert-register.csv', toCsv(['Opened', 'Event start', 'Recovered', 'Kind', 'Severity', 'Status', 'Zone', 'Peak C', 'Deviation C', 'Duration min', 'Cause', 'Action taken'],
    (alerts.data ?? []).map((a) => [a.opened_at, a.event_start, a.recovered_at, a.kind, a.severity, a.status, zone.get(a.zone_id), a.peak_value, a.peak_deviation, a.duration_min, a.cause, a.action_taken])))
  return (
    <div>
      <PageHeader title={t('cold.alertsTitle')} actions={<Button variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!alerts.data?.length} onClick={csv}>CSV</Button>} />
      <Card>
        <Toolbar>
          <div className="flex gap-1" role="tablist">{(['open', 'all'] as const).map((v) => <Button key={v} size="sm" variant={view === v ? 'primary' : 'secondary'} onClick={() => setView(v)} role="tab" aria-selected={view === v}>{t(`cold.view.${v}`)}</Button>)}</div>
          <Select aria-label={t('common.warehouse')} value={wh} onChange={(e) => setWh(e.target.value)} className="sm:w-56"><option value="">{t('common.all')}</option>{(whs.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</Select>
        </Toolbar>
        {alerts.isPending ? <div className="flex justify-center p-6"><Spinner /></div> : <AlertRows alerts={alerts.data ?? []} onOpen={setSelected} />}
      </Card>
      {selected && <AlertDetail alertId={selected.id} onClose={() => setSelected(null)} />}
    </div>
  )
}
