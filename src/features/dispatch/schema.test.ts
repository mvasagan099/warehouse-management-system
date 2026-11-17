import { describe, expect, it } from 'vitest'
import { dispatchLineSchema, stockChoices } from './schema'

describe('dispatch request form', () => {
  it('groups stock rows into one choice per SKU and unit', () => {
    const c = stockChoices([
      { item_name: 'Frozen peas', sku: 'FRZ-001', unit: 'BOX', quantity: 30, batch_no: 'B-EARLY' },
      { item_name: 'Frozen peas', sku: 'FRZ-001', unit: 'BOX', quantity: 70.5, batch_no: 'B-LATE' },
      { item_name: 'Rice', sku: null, unit: 'BAG', quantity: 50, batch_no: null },
    ])
    expect(c).toHaveLength(2)
    expect(c[0]).toMatchObject({ sku: 'FRZ-001', available: 100.5, batches: ['B-EARLY', 'B-LATE'] })
    expect(c[1]).toMatchObject({ item_name: 'Rice', batches: [] })
  })
  it('requires a positive quantity', () => {
    const base = { item_name: 'x', sku: null, unit: 'BOX', batch_no: null }
    expect(dispatchLineSchema.safeParse({ ...base, quantity: '12.5' }).success).toBe(true)
    expect(dispatchLineSchema.safeParse({ ...base, quantity: '0' }).success).toBe(false)
    expect(dispatchLineSchema.safeParse({ ...base, quantity: 'abc' }).success).toBe(false)
  })
})
