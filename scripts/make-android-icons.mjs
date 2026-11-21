// Renders the Slott launcher icons into android/app/src/main/res (legacy, round and adaptive foreground).
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const full = readFileSync('public/icon.svg', 'utf8')
// the mark only (no tile): the three slots, for the adaptive foreground
const mark = full.replace(/<rect width="512" height="512"[^>]*\/>/, '')
const res = 'android/app/src/main/res'
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const browser = await chromium.launch()
async function render(html, size, path) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;background:transparent"><style>svg{width:100%;height:100%;display:block}</style>${html}</body>`)
  await page.screenshot({ path, omitBackground: true })
  await page.close()
}
for (const [d, k] of Object.entries(dens)) {
  const legacy = Math.round(48 * k), fg = Math.round(108 * k)
  await render(full, legacy, `${res}/mipmap-${d}/ic_launcher.png`)
  await render(`<div style="width:100%;height:100%;border-radius:50%;overflow:hidden">${full.replace(/rx="\d+"/, 'rx="0"')}</div>`, legacy, `${res}/mipmap-${d}/ic_launcher_round.png`)
  // adaptive foreground: art kept inside the central 61% safe zone
  await render(`<div style="position:absolute;inset:19.5%">${mark}</div>`, fg, `${res}/mipmap-${d}/ic_launcher_foreground.png`)
}
await browser.close()
writeFileSync(`${res}/values/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0E2238</color>\n</resources>\n')
console.log('android icons written')
