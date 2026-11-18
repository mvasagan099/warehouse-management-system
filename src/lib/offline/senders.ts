import { supabase } from '../supabase'
import { isNetworkError, type QueueItem, type SendResult, type Sender } from './queue'

function fromError(err: { code?: string; message?: string } | null): SendResult {
  if (isNetworkError(err)) return { type: 'offline' }
  return { type: 'rejected', message: err?.message ?? 'The server refused this entry' }
}

/** Gate entry: inserted with the id made on the phone, so a retry after a lost reply never creates a second lorry. */
async function sendGateEntry(item: QueueItem): Promise<SendResult> {
  const { error } = await supabase.from('gate_entries').insert({ ...(item.payload as object), id: item.id } as never)
  if (!error) return { type: 'ok' }
  if (error.code === '23505') {
    const { data } = await supabase.from('gate_entries').select('id').eq('id', item.id).maybeSingle()
    if (data) return { type: 'duplicate' }
    return { type: 'rejected', message: error.message }            // same lorry already at the gate: ask the user
  }
  return fromError(error)
}

/** A counted quantity on a gate line: if somebody else changed the line since this phone saw it, ask. */
async function sendCount(item: QueueItem, opts: { overwrite: boolean }): Promise<SendResult> {
  const { line_id, counted_qty } = item.payload as { line_id: string; counted_qty: number }
  const { data: cur, error: readErr } = await supabase.from('gate_entry_lines').select('counted_qty, updated_at').eq('id', line_id).maybeSingle()
  if (readErr) return fromError(readErr)
  if (!cur) return { type: 'rejected', message: 'This line no longer exists' }
  const changed = item.baseUpdatedAt != null && cur.updated_at !== item.baseUpdatedAt
  if (changed && cur.counted_qty !== counted_qty && !opts.overwrite) return { type: 'conflict', serverValue: { counted_qty: cur.counted_qty, updated_at: cur.updated_at } }
  if (cur.counted_qty === counted_qty) return { type: 'duplicate' }
  const { error } = await supabase.from('gate_entry_lines').update({ counted_qty }).eq('id', line_id)
  return error ? fromError(error) : { type: 'ok' }
}

async function sendManualReading(item: QueueItem): Promise<SendResult> {
  const p = item.payload as { zone_id: string; value: number; note?: string | null; recorded_at?: string }
  const { error } = await supabase.rpc('add_manual_reading', { p_zone_id: p.zone_id, p_value: p.value, p_note: p.note ?? undefined })
  if (!error) return { type: 'ok' }
  return fromError(error)
}

async function sendScan(item: QueueItem): Promise<SendResult> {
  const p = item.payload as { pick_id: string; code: string }
  const { error } = await supabase.rpc('record_pick_scan', { p_pick_id: p.pick_id, p_code: p.code })
  return error ? fromError(error) : { type: 'ok' }
}

async function sendAttendance(item: QueueItem): Promise<SendResult> {
  const p = item.payload as { dir: 'IN' | 'OUT'; lat?: number | null; lon?: number | null; at: string }
  const args = { p_lat: p.lat ?? undefined, p_lon: p.lon ?? undefined, p_at: p.at }
  const { data, error } = p.dir === 'IN' ? await supabase.rpc('check_in', args) : await supabase.rpc('check_out', args)
  if (error) return fromError(error)
  return (data as { status?: string } | null)?.status === 'ALREADY' ? { type: 'duplicate' } : { type: 'ok' }
}

export const sendItem: Sender = async (item, opts) => {
  try {
    switch (item.kind) {
      case 'gate_entry': return await sendGateEntry(item)
      case 'count': return await sendCount(item, opts)
      case 'manual_reading': return await sendManualReading(item)
      case 'scan': return await sendScan(item)
      case 'attendance': return await sendAttendance(item)
    }
  } catch (e) {
    return isNetworkError(e) ? { type: 'offline' } : { type: 'rejected', message: e instanceof Error ? e.message : String(e) }
  }
}
