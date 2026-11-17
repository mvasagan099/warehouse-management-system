import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { Card, EmptyState, PageHeader, Toolbar } from '../../components/ui/misc'
import { formatDate } from '../../lib/format'
import { slotPayload, stockPayload } from '../../lib/scan'
import { supabase } from '../../lib/supabase'
import { useClients, useWarehouses, useZones } from '../shared/queries'

interface Label { id: string; payload: string; title: string; lines: string[] }

function useQrImages(labels: Label[]) {
  const [images, setImages] = useState<Record<string, string>>({})
  const key = labels.map((l) => l.id).join('|')
  useEffect(() => {
    let alive = true
    Promise.all(labels.map(async (l) => [l.id, await QRCode.toDataURL(l.payload, { margin: 1, width: 220, errorCorrectionLevel: 'M' })] as const))
      .then((pairs) => { if (alive) setImages(Object.fromEntries(pairs)) })
    return () => { alive = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return images
}

/** Printable QR labels: one per slot, one per pallet / batch. The scanner and picking understand the same codes. */
export function LabelsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const [params] = useSearchParams()
  const stockParam = params.get('stock')
  const [mode, setMode] = useState<'slots' | 'stock'>(stockParam ? 'stock' : 'slots')
  const warehouses = useWarehouses()
  const clients = useClients()
  const [warehouseId, setWarehouseId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [clientId, setClientId] = useState('')
  const zones = useZones(warehouseId || undefined)
  const wh = warehouseId || (warehouses.data?.length === 1 ? warehouses.data[0].id : '')

  const slots = useQuery({
    queryKey: ['label_slots', wh, zoneId],
    enabled: mode === 'slots' && !!zoneId,
    queryFn: async () => {
      const { data, error } = await supabase.from('brigade_slots').select('id, code').eq('zone_id', zoneId).is('deleted_at', null)
        .order('aisle').order('rack').order('level').order('position').limit(300)
      if (error) throw error
      return data
    },
  })
  const stock = useQuery({
    queryKey: ['label_stock', wh, clientId, stockParam],
    enabled: mode === 'stock',
    queryFn: async () => {
      let q = supabase.from('stock_items').select('*').is('deleted_at', null).gt('quantity', 0).order('slot_code').limit(300)
      if (stockParam) q = q.eq('id', stockParam)
      else { if (wh) q = q.eq('warehouse_id', wh); if (clientId) q = q.eq('client_id', clientId) }
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])), [clients.data])
  const labels: Label[] = useMemo(() => {
    if (mode === 'slots') return (slots.data ?? []).map((s) => ({ id: s.id, payload: slotPayload(s.id), title: s.code, lines: [t('labels.slotLabel')] }))
    return (stock.data ?? []).map((i) => ({
      id: i.id, payload: stockPayload(i.id), title: i.batch_no || i.sku || i.item_name,
      lines: [i.item_name, clientName.get(i.client_id) ?? '', `${t('common.slot')}: ${i.slot_code}`, i.expiry_date ? `${t('common.expiry')}: ${formatDate(i.expiry_date, lang)}` : ''].filter(Boolean),
    }))
  }, [mode, slots.data, stock.data, clientName, lang, t])
  const images = useQrImages(labels)
  const loading = mode === 'slots' ? slots.isFetching : stock.isFetching

  return (
    <div>
      <PageHeader title={t('labels.title')} subtitle={t('labels.help')} actions={<Button icon={<Printer className="h-4 w-4" />} disabled={!labels.length} onClick={() => window.print()}>{t('common.print')}</Button>} />
      <div className="no-print mb-3 flex gap-1 border-b border-slate-200" role="tablist">
        {(['slots', 'stock'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={clsx('-mb-px border-b-2 px-4 py-2 text-sm font-medium', mode === m ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500')}>{t(`labels.mode.${m}`)}</button>
        ))}
      </div>
      <Card>
        <Toolbar>
          {(warehouses.data?.length ?? 0) > 1 && (
            <Select aria-label={t('common.warehouse')} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setZoneId('') }} className="sm:w-56">
              <option value="">{t('common.warehouse')}</option>
              {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
            </Select>
          )}
          {mode === 'slots' ? (
            <Select aria-label={t('common.zone')} value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="sm:w-64">
              <option value="">{t('labels.pickZone')}</option>
              {zones.data?.filter((z) => !wh || z.warehouse_id === wh).map((z) => <option key={z.id} value={z.id}>{z.code} · {z.name}</option>)}
            </Select>
          ) : !stockParam && (
            <Select aria-label={t('common.client')} value={clientId} onChange={(e) => setClientId(e.target.value)} className="sm:w-64">
              <option value="">{t('stock.allClients')}</option>
              {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </Select>
          )}
        </Toolbar>
        {!labels.length ? (
          <EmptyState message={loading ? t('common.loading') : mode === 'slots' ? t('labels.pickZone') : t('stock.empty')} />
        ) : (
          <div className="print-area grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="label-sheet">
            {labels.map((l) => (
              <div key={l.id} className="flex break-inside-avoid flex-col items-center rounded-lg border border-slate-300 p-2 text-center">
                {images[l.id] ? <img src={images[l.id]} alt={`QR ${l.title}`} className="h-32 w-32" /> : <div className="h-32 w-32 animate-pulse bg-slate-100" />}
                <div className="mt-1 font-mono text-sm font-bold">{l.title}</div>
                {l.lines.map((x, i) => <div key={i} className="text-xs text-slate-600">{x}</div>)}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
