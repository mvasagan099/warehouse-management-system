import { describe, expect, it } from 'vitest'
import { brigadeTypeSchema, previewVolume } from './schema'

describe('brigade types', () => {
  it('previews the standard 1.2 m cube as 1.728 m³', () => {
    expect(previewVolume('1.2', '1.2', '1.2')).toBe(1.728)
    expect(previewVolume('2.4', '1.2', '1.2')).toBe(3.456)
    expect(previewVolume('', '1', '1')).toBeNull()
  })
  it('requires positive dimensions and weight', () => {
    const ok = brigadeTypeSchema.safeParse({ name: 'Half Brigade', description: '', length_m: '1.2', width_m: '1.2', height_m: '0.6', max_weight_kg: '500' })
    expect(ok.success).toBe(true)
    const bad = brigadeTypeSchema.safeParse({ name: 'X', description: '', length_m: '0', width_m: '-1', height_m: 'a', max_weight_kg: '' })
    expect(bad.success).toBe(false)
    if (!bad.success) expect(bad.error.issues.map((i) => i.path[0])).toEqual(['length_m', 'width_m', 'height_m', 'max_weight_kg'])
  })
})
