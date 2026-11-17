import type { Json } from '../../types/database'

type Row = { [key: string]: Json | undefined }
const IGNORED = new Set(['updated_at'])

export interface FieldChange {
  field: string
  before: Json | undefined
  after: Json | undefined
}

/** Fields that differ between the old and new row JSON of an audit entry. */
export function changedFields(oldData: Json | null, newData: Json | null): FieldChange[] {
  const o = (oldData && typeof oldData === 'object' && !Array.isArray(oldData) ? oldData : {}) as Row
  const n = (newData && typeof newData === 'object' && !Array.isArray(newData) ? newData : {}) as Row
  const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter((k) => !IGNORED.has(k)).sort()
  return keys
    .filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]))
    .map((k) => ({ field: k, before: o[k], after: n[k] }))
}

export function displayValue(v: Json | undefined): string {
  if (v === undefined || v === null) return '—'
  return typeof v === 'string' ? v : JSON.stringify(v)
}
