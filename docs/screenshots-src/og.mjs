import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

// The Open Graph image: the hero of the landing page (logo, headline, speed graph) at 1200x630.
// The site folder is mounted at /site, the result lands in /out/og-image.png.
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  try {
    res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' })
    res.end(readFileSync(join('/site', path === '/' ? 'index.html' : path)))
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(8099, '127.0.0.1', resolve))

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'dark' })
const page = await context.newPage()
await page.goto('http://127.0.0.1:8099/index.html')
await page.waitForTimeout(5000) // intro animation and the headline have played
await page.addStyleTag({
  content: `
    .nav, .hi-cta, .heropara, .particles, .slot, #speedgraph { display: none !important; }
    .lg-color { opacity: 1 !important; animation: none !important; }
    .lg-outline { opacity: 0 !important; animation: none !important; }
    .graphwrap { height: 260px !important; animation: none !important; }
    .herotitle { font-size: 66px !important; max-width: 900px !important; }
    .herologo { width: 120px !important; }
    .herowrap { padding-bottom: 110px !important; }
    .adj { font-size: 36px; font-weight: 700; letter-spacing: -.02em; color: var(--accent); white-space: nowrap; }
  `
})
await page.evaluate(() => {
  // A calm graph instead of the live simulation: plateaus, two dips, no noise and no label.
  const wrap = document.querySelector('.graphwrap')
  const canvas = document.createElement('canvas')
  canvas.width = 1200 * 2
  canvas.height = 260 * 2
  canvas.style.cssText = 'display:block;width:100%;height:100%'
  wrap.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  const dip = (x, at, width) => Math.exp(-(((x - at) / width) ** 2))
  const speed = (x) => (0.62 + 0.2 * Math.sin(x / 190 + 0.8) + 0.08 * Math.sin(x / 71 + 2)) * (1 - 0.9 * dip(x, 380, 38)) * (1 - 0.55 * dip(x, 860, 70)) * Math.min(1, x / 90 + 0.35)
  const y = (x) => 258 - speed(x) * 185
  const path = () => {
    ctx.beginPath()
    ctx.moveTo(0, y(0))
    for (let x = 2; x <= 1200; x += 2) ctx.lineTo(x, y(x))
  }
  path()
  ctx.lineTo(1200, 260)
  ctx.lineTo(0, 260)
  const fill = ctx.createLinearGradient(0, 0, 0, 260)
  fill.addColorStop(0, accent + '55')
  fill.addColorStop(0.6, accent + '1a')
  fill.addColorStop(1, accent + '00')
  ctx.fillStyle = fill
  ctx.fill()
  path()
  ctx.strokeStyle = accent + 'cc'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.stroke()
  const adj = document.createElement('div')
  adj.className = 'adj'
  adj.textContent = 'Faster. More modern. Self-hosted. Phone-friendly. Private.'
  document.querySelector('.herotitle').after(adj)
})
await page.waitForTimeout(500)
await page.screenshot({ path: '/out/og-image.png' })
await browser.close()
server.close()
