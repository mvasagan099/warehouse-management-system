import { describe, expect, it } from 'vitest'
import { disabledAreas } from './features'

describe('feature switches', () => {
  it('hides the areas of every switch that is off', () => {
    expect([...disabledAreas({ sensors: false, qr: false, coldChain: false })].sort()).toEqual(['coldChain', 'labels', 'scan', 'sensors'])
  })
  it('hides nothing when switches are on or unknown', () => {
    expect(disabledAreas({ sensors: true, qr: true, coldChain: true }).size).toBe(0)
    expect(disabledAreas(undefined).size).toBe(0)
    expect(disabledAreas({}).size).toBe(0)
  })
})
