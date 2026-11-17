// QR payloads printed on labels. The same formats are understood by the database
// (record_pick_scan): WMS:SLOT:<slot id> and WMS:STOCK:<stock item id>.
export type ScanTarget =
  | { kind: 'slot'; id: string }
  | { kind: 'stock'; id: string }
  | { kind: 'text'; text: string }

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

export const slotPayload = (id: string) => `WMS:SLOT:${id}`
export const stockPayload = (id: string) => `WMS:STOCK:${id}`

export function parseScan(raw: string): ScanTarget {
  const v = raw.trim()
  const slot = new RegExp(`^WMS:SLOT:(${UUID})$`, 'i').exec(v)
  if (slot) return { kind: 'slot', id: slot[1].toLowerCase() }
  const stock = new RegExp(`^WMS:STOCK:(${UUID})$`, 'i').exec(v)
  if (stock) return { kind: 'stock', id: stock[1].toLowerCase() }
  return { kind: 'text', text: v }
}
