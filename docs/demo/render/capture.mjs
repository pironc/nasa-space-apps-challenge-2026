import { createRequire } from 'node:module'
const [url, out] = process.argv.slice(2)
// playwright-core from this folder (npm i), the browser it installed, or CHROME if set
const { chromium } = createRequire(import.meta.url)('playwright-core')
const exe = process.env.CHROME || undefined
const b = await chromium.launch({ executablePath: exe, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
let pending = 0, last = Date.now()
const tile = (r) => /planetarycomputer|gibs|eox|openfreemap/.test(r.url())
p.on('request', (r) => { if (tile(r)) { pending++; last = Date.now() } })
const done = (r) => { if (tile(r)) { pending = Math.max(0, pending - 1); last = Date.now() } }
p.on('requestfinished', done); p.on('requestfailed', done)
const settle = async (min = 800, max = 20000) => { const t0 = Date.now(); await p.waitForTimeout(min); while (Date.now() - t0 < max && (pending > 0 || Date.now() - last < 700)) await p.waitForTimeout(100) }
const shot = (n) => p.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 92 })

await p.goto(`${url}/?field=kostanay-fyodorov&date=2021-07-15`); await p.waitForSelector('canvas.maplibregl-canvas')
await p.getByRole('button', { name: 'Toggle Sidebar' }).first().click(); await settle(3000)
await p.locator('button[aria-pressed]', { hasText: '2021' }).first().click(); await settle(2500)
await shot('story')
await p.getByRole('tab', { name: 'Growth' }).click(); await settle(2500); await shot('growth')
await p.getByRole('tab', { name: 'Weather' }).click(); await settle(3000); await shot('weather')
await p.getByRole('tab', { name: 'Options' }).click(); await p.getByRole('button', { name: 'Compare the three options side by side' }).click(); await settle(2500); await shot('options')
// the field pass by pass, map only
await p.getByRole('button', { name: 'Compare the three options side by side' }).click()
await p.getByRole('tab', { name: 'Growth' }).click(); await settle(2500)
await p.getByRole('button', { name: 'Hide the analysis panel' }).click(); await settle(2500)
for (const [y, dates] of Object.entries(JSON.parse(process.argv[4]))) {
  for (const d of dates) {
    const thumb = p.getByRole('slider', { name: 'Date within the year' })
    // step with the keyboard until the date shown is the pass
    for (let k = 0; k < 40; k++) {
      const shown = await p.locator('div.text-sm.font-medium.tabular-nums').first().innerText()
      const want = new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      if (shown === want) break
      await thumb.focus(); await thumb.press(Date.parse(new Date(shown + ' UTC')) < Date.parse(d) ? 'ArrowRight' : 'ArrowLeft'); await p.waitForTimeout(80)
    }
    await settle(1200, 25000); await shot(`pass-${d}`); process.stdout.write(d + ' ')
  }
  if (y === '2021') { await p.getByRole('combobox', { name: 'Year' }).click(); await p.getByRole('option', { name: '2024' }).click(); await settle(1500) }
}
console.log('\ndone')
await b.close()
