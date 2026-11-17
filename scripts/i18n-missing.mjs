// Lists translation keys used in the code (literal t('a.b') calls and 'validation.x' strings) that are missing from en.json.
import fs from 'node:fs'
import path from 'node:path'
const root = 'src'
const files = []
;(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) && !/\.test\./.test(f) && files.push(p) } })(root)
const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'))
const has = (k) => k.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), en) !== undefined
const used = new Map()
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/\bt\(\s*['"`]([A-Za-z0-9_.]+)['"`]/g)) used.set(m[1], f)
  for (const m of s.matchAll(/['"`]((?:validation)\.[A-Za-z0-9_]+)['"`]/g)) used.set(m[1], f)
  for (const m of s.matchAll(/(?:titleKey|bodyKey|labelKey)=?:?\s*['"`]([A-Za-z0-9_.]+)['"`]/g)) used.set(m[1], f)
}
const missing = [...used.keys()].filter((k) => !has(k) && k.includes('.')).sort()
console.log(missing.join('\n'))
console.error(`${missing.length} missing of ${used.size} used keys`)
