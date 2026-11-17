import { z } from 'zod'
import { optionalText } from '../../lib/zod'

export const dispatchLineSchema = z.object({
  item_name: z.string().trim().min(1, 'validation.required'),
  sku: z.string().nullable(),
  unit: z.string().trim().min(1),
  batch_no: z.string().nullable(),
  quantity: z.string().trim().refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, 'validation.positive').transform(Number),
})

export const dispatchSchema = z.object({
  client_id: z.string().min(1, 'validation.required'),
  warehouse_id: z.string().min(1, 'validation.required'),
  to_company_id: z.string().min(1, 'validation.required'),
  requested_date: z.string().min(1, 'validation.required'),
  remarks: optionalText(500),
})
export type DispatchFormInput = z.input<typeof dispatchSchema>
export type DispatchFormOutput = z.output<typeof dispatchSchema>
export type DispatchLineOutput = z.output<typeof dispatchLineSchema>

export interface StockChoice { key: string; item_name: string; sku: string | null; unit: string; available: number; batches: string[] }

/** One choice per SKU (or item name) and unit, with the batches that exist: the client picks from what is really in stock. */
export function stockChoices(rows: { item_name: string; sku: string | null; unit: string; quantity: number; batch_no: string | null }[]): StockChoice[] {
  const map = new Map<string, StockChoice>()
  for (const r of rows) {
    const key = `${r.sku ?? r.item_name}|${r.unit}`
    const cur = map.get(key) ?? { key, item_name: r.item_name, sku: r.sku, unit: r.unit, available: 0, batches: [] }
    cur.available = Math.round((cur.available + Number(r.quantity)) * 1000) / 1000
    if (r.batch_no && !cur.batches.includes(r.batch_no)) cur.batches.push(r.batch_no)
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => a.item_name.localeCompare(b.item_name))
}
