import { describe, expect, it } from 'vitest'
import { emptyWarehouse, toPayload, warehouseSchema } from './schema'

describe('warehouseSchema', () => {
  it('maps blanks to null and lets the DB generate the code', () => {
    const out = warehouseSchema.parse({ ...emptyWarehouse, name: 'Chennai Cold Hub' })
    const payload = toPayload(out)
    expect(payload).not.toHaveProperty('code')
    expect(payload).toMatchObject({ name: 'Chennai Cold Hub', state: 'Tamil Nadu', pincode: null, latitude: null })
  })
  it('validates Indian PIN codes, GPS ranges and uppercases the code', () => {
    const r = warehouseSchema.safeParse({ ...emptyWarehouse, name: 'X', code: 'w9', pincode: '600001', latitude: '13.0827', longitude: '80.2707' })
    expect(r.success && r.data).toMatchObject({ code: 'W9', pincode: '600001', latitude: 13.0827 })
    const bad = warehouseSchema.safeParse({ ...emptyWarehouse, name: 'X', pincode: '012345', latitude: '91' })
    expect(bad.success).toBe(false)
    if (!bad.success) expect(bad.error.issues.map((i) => i.message)).toEqual(['validation.pincode', 'validation.latitude'])
  })
})
