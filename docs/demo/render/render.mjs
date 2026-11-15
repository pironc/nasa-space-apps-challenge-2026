import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const [dir, out, only] = process.argv.slice(2)
// playwright-core from this folder (npm i), the browser it installed, or CHROME if set
const { chromium } = createRequire(import.meta.url)('playwright-core')
const exe = process.env.CHROME || undefined
const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto('file://' + dir + '/film.html'); await p.evaluate(() => window.ready)
if (only) { // stills for checking: comma-separated seconds
  for (const t of only.split(',')) { await p.evaluate((t) => window.render(t), +t); await p.waitForTimeout(150); await p.screenshot({ path: `${dir}/still-${t}.png` }) }
  await b.close(); process.exit(0)
}
const FPS = 30, N = Math.round(await p.evaluate(() => window.DURATION) * FPS)
const frames = dir + '/frames.mjpeg'
const fd = fs.openSync(frames, 'w')
for (let f = 0; f < N; f++) {
  await p.evaluate((t) => window.render(t), f / FPS)
  fs.writeSync(fd, await p.screenshot({ type: 'jpeg', quality: 95 }))
}
fs.closeSync(fd)
// the browser tools' ffmpeg reads no pipe: it reads the frames as one concatenated JPEG stream
const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', frames, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', '-deadline', 'good', '-cpu-used', '3', '-row-mt', '1', '-pix_fmt', 'yuv420p', out], { stdio: 'inherit' })
await new Promise((r) => ff.on('close', r)); await b.close(); console.log('frames', N)
