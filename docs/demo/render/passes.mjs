import { createRequire } from 'node:module'
const [url, out, list] = process.argv.slice(2)
// playwright-core from this folder (npm i), the browser it installed, or CHROME if set
const { chromium } = createRequire(import.meta.url)('playwright-core')
const exe = process.env.CHROME || undefined
const b = await chromium.launch({ executablePath: exe, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })
let pending = 0, last = Date.now()
const tile = (r) => /planetarycomputer|gibs|eox|openfreemap/.test(r.url())
p.on('request', (r) => { if (tile(r)) { pending++; last = Date.now() } })
const done = (r) => { if (tile(r)) { pending = Math.max(0, pending - 1); last = Date.now() } }
p.on('requestfinished', done); p.on('requestfailed', done)
const settle = async (min = 800, max = 25000) => { const t0 = Date.now(); await p.waitForTimeout(min); while (Date.now() - t0 < max && (pending > 0 || Date.now() - last < 700)) await p.waitForTimeout(100) }
await p.goto(`${url}/?field=kostanay-fyodorov&date=2021-06-05&tab=growth`); await p.waitForSelector('canvas.maplibregl-canvas')
await p.getByRole('button', { name: 'Toggle Sidebar' }).first().click(); await settle(2500)
await p.getByRole('button', { name: 'Hide the analysis panel' }).click(); await settle(2500)
const label = () => p.locator('div.text-sm.font-medium.tabular-nums').first().innerText()
const fmt = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
for (const d of JSON.parse(list)) {
  if (!(await label()).endsWith(d.slice(0, 4))) { await p.getByRole('combobox', { name: 'Year' }).click(); await p.getByRole('option', { name: d.slice(0, 4) }).click(); await p.waitForTimeout(300) }
  const thumb = p.getByRole('slider', { name: 'Date within the year' })
  for (let k = 0; k < 60 && (await label()) !== fmt(d); k++) { await thumb.focus(); await thumb.press(Date.parse((await label()) + ' UTC') < Date.parse(d) ? 'ArrowRight' : 'ArrowLeft'); await p.waitForTimeout(60) }
  await settle(1200)
  await p.addStyleTag({ content: '.inset-x-3{visibility:hidden!important}' })
  await p.screenshot({ path: `${out}/${d}.jpg`, type: 'jpeg', quality: 92 })
  await p.addStyleTag({ content: '.inset-x-3{visibility:visible!important}' })
  process.stdout.write(d + ' ')
}
await b.close()
