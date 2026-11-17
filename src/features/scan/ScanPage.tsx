import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ScannerInput } from '../../components/ui/ScannerInput'
import { Badge, Card, PageHeader } from '../../components/ui/misc'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime, formatNumber } from '../../lib/format'
import { parseScan } from '../../lib/scan'
import { supabase } from '../../lib/supabase'
import type { BrigadeSlot, StockItem, StockMovement } from '../../lib/types'

interface Result {
  code: string
  slot?: BrigadeSlot | null
  items: StockItem[]
  movements: StockMovement[]
  note?: string
}

/** Camera or keyboard scan of a slot / pallet / batch label: shows what is there. */
export function ScanPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const [history, setHistory] = useState<Result[]>([])

  const lookup = useMutation({
    mutationFn: async (code: string): Promise<Result> => {
      const target = parseScan(code)
      if (target.kind === 'slot') {
        const [s, i] = await Promise.all([
          supabase.from('brigade_slots').select('*').eq('id', target.id).maybeSingle(),
          supabase.from('stock_items').select('*').eq('slot_id', target.id).gt('quantity', 0).is('deleted_at', null),
        ])
        if (s.error) throw s.error
        if (i.error) throw i.error
        return { code, slot: s.data, items: i.data, movements: [], note: s.data ? undefined : t('scan.notFound') }
      }
      if (target.kind === 'stock') {
        const [i, m] = await Promise.all([
          supabase.from('stock_items').select('*').eq('id', target.id).maybeSingle(),
          supabase.from('stock_movements').select('*').eq('stock_item_id', target.id).order('created_at', { ascending: false }).limit(8),
        ])
        if (i.error) throw i.error
        return { code, items: i.data ? [i.data] : [], movements: m.data ?? [], note: i.data ? undefined : t('scan.notFound') }
      }
      // plain text: a slot code or a batch number
      const text = target.text
      const [slot, byBatch] = await Promise.all([
        supabase.from('brigade_slots').select('*').ilike('code', text).is('deleted_at', null).maybeSingle(),
        supabase.from('stock_items').select('*').ilike('batch_no', text).gt('quantity', 0).is('deleted_at', null).limit(50),
      ])
      let items = byBatch.data ?? []
      if (slot.data) {
        const inSlot = await supabase.from('stock_items').select('*').eq('slot_id', slot.data.id).gt('quantity', 0).is('deleted_at', null)
        items = inSlot.data ?? []
      }
      return { code, slot: slot.data, items, movements: [], note: !slot.data && items.length === 0 ? t('scan.notFound') : undefined }
    },
    onSuccess: (r) => setHistory((h) => [r, ...h].slice(0, 10)),
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const onScan = useCallback((code: string) => lookup.mutate(code), [lookup])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('scan.title')} subtitle={t('scan.help')} />
      <Card className="mb-4 p-4"><ScannerInput onScan={onScan} autoFocus /></Card>
      <div className="space-y-3">
        {history.map((r, idx) => (
          <Card key={`${r.code}-${idx}`} className="p-4" >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{r.code}</span>
              {r.slot && <Badge tone="cyan">{r.slot.code} · {t(`slotStatus.${r.slot.status}`)}</Badge>}
              {r.note && <Badge tone="red">{r.note}</Badge>}
            </div>
            {r.items.length > 0 && (
              <ul className="divide-y divide-slate-100 text-sm">
                {r.items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span><span className="font-medium">{i.item_name}</span> <span className="text-slate-500">{i.batch_no}</span> · <span className="font-mono text-xs">{i.slot_code}</span>{i.expiry_date && <span className="text-slate-500"> · {t('common.expiry')} {formatDate(i.expiry_date, lang)}</span>}</span>
                    <span className="font-semibold">{formatNumber(i.quantity, lang, 3)} {i.unit}</span>
                  </li>
                ))}
              </ul>
            )}
            {r.movements.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                {r.movements.map((m) => <div key={m.id}>{formatDateTime(m.created_at, lang)} · {t(`movementType.${m.movement_type}`)} {m.qty_delta > 0 ? '+' : ''}{m.qty_delta} {m.reason ? `· ${m.reason}` : ''}</div>)}
              </div>
            )}
          </Card>
        ))}
        {history.length === 0 && <p className="text-center text-sm text-slate-500">{t('scan.empty')}</p>}
      </div>
    </div>
  )
}
