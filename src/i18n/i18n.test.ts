import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ta from './locales/ta.json'

type Tree = { [k: string]: string | Tree }
function flatten(obj: Tree, prefix = ''): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'string' ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) }
  }, {})
}

describe('translations', () => {
  const e = flatten(en as Tree)
  const t = flatten(ta as Tree)
  it('English and Tamil have exactly the same keys', () => {
    expect(Object.keys(t).sort()).toEqual(Object.keys(e).sort())
  })
  it('no empty strings', () => {
    expect(Object.entries(t).filter(([, v]) => !v.trim())).toEqual([])
    expect(Object.entries(e).filter(([, v]) => !v.trim())).toEqual([])
  })
  it('keeps the same interpolation variables', () => {
    const vars = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).sort().join(',')
    const mismatched = Object.keys(e).filter((k) => vars(e[k]) !== vars(t[k]))
    expect(mismatched).toEqual([])
  })
  it('Tamil text actually contains Tamil script', () => {
    expect(t['nav.dashboard']).toMatch(/[஀-௿]/)
  })
})
