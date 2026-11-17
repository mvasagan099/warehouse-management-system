import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import ta from './locales/ta.json'

type Tree = { [k: string]: string | Tree }
const has = (tree: Tree, key: string) => key.split('.').reduce<unknown>((o, p) => (o && typeof o === 'object' ? (o as Tree)[p] : undefined), tree) !== undefined

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) return sourceFiles(p)
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []
  })
}

describe('every text key used in the code exists in English and Tamil', () => {
  const used = new Map<string, string>()
  for (const f of sourceFiles('src')) {
    const s = fs.readFileSync(f, 'utf8')
    for (const m of s.matchAll(/\bt\(\s*['"`]([A-Za-z0-9_.]+)['"`]/g)) used.set(m[1], f)
    for (const m of s.matchAll(/['"`]((?:validation)\.[A-Za-z0-9_]+)['"`]/g)) used.set(m[1], f)
    for (const m of s.matchAll(/(?:titleKey|bodyKey|labelKey)=?:?\s*['"`]([A-Za-z0-9_.]+)['"`]/g)) used.set(m[1], f)
  }
  const keys = [...used.keys()].filter((k) => k.includes('.')).sort()
  it('finds the keys', () => expect(keys.length).toBeGreaterThan(300))
  it('has them all in en.json', () => expect(keys.filter((k) => !has(en as Tree, k))).toEqual([]))
  it('has them all in ta.json', () => expect(keys.filter((k) => !has(ta as Tree, k))).toEqual([]))
})
