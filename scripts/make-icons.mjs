// Renders public/icon.svg to the PNG sizes the web manifest needs (uses the Chromium that Playwright already installed).
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icon.svg', 'utf8')
const sizes = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, false]]
const browser = await chromium.launch()
for (const [name, size, maskable] of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  // a maskable icon keeps its art inside the central 80% and fills the whole square
  const art = maskable ? `<div style="position:absolute;inset:10%">${svg.replace('rx="96"', 'rx="0"')}</div>` : svg
  await page.setContent(`<body style="margin:0;background:${maskable ? '#0e2238' : 'transparent'};width:${size}px;height:${size}px;position:relative"><style>svg{width:100%;height:100%;display:block}</style>${art}</body>`)
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: !maskable })
  await page.close()
}
await browser.close()
console.log('icons written')
