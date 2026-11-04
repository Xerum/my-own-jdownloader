// Smoke test: open every screen of the web UI against a throw-away JD test device (testing/devices/) and report
// any JS error the page threw. Not a replacement for real testing, just a quick way to catch crashes like a
// TDZ bug or a bad selector before they reach the live JDownloader. Run via testing/run.sh.
import { existsSync } from 'fs'
import { lookup } from 'node:dns/promises'
import { HtmlValidate } from 'html-validate'
import puppeteer, { type Browser, type ConsoleMessage, type Page } from 'puppeteer-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const DEVICE = process.env.TEST_DEVICE ?? 'jd-test-1'
const UI_PASSWORD = process.env.UI_PASSWORD
// OVH's well-known bandwidth test file: public, stable for years, no account needed. Never auto-started, only
// added to and then removed from the linkgrabber again.
const TEST_LINK = 'https://proof.ovh.net/files/1Mb.dat'
const TEST_PACKAGE_NAME = 'ui-check'

type Result = { name: string; errors: string[] }
const results: Result[] = []

const authHeader = UI_PASSWORD ? `Basic ${Buffer.from(`ui-check:${UI_PASSWORD}`).toString('base64')}` : undefined

const api = async (path: string, init?: RequestInit): Promise<any> => {
  const res = await fetch(`${APP_URL}${path}`, { ...init, headers: { ...init?.headers, ...(authHeader ? { Authorization: authHeader } : {}) } })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  const text = await res.text()
  return text ? JSON.parse(text) : undefined
}

const findChromium = (): string => {
  const path = ['/usr/bin/chromium-browser', '/usr/bin/chromium'].find(existsSync)
  if (!path) throw new Error('No Chromium found (expected the Alpine chromium package)')
  return path
}

// The DOM as the page actually rendered it (after Vue ran), not the static index.html. Only markup correctness,
// not style or accessibility preferences (html-validate:recommended is mostly noise here: JD's config keys become
// element ids with dots/spaces, Vue writes boolean attributes and inline styles, icon-only buttons have no text…).
const htmlvalidate = new HtmlValidate({
  rules: {
    'no-dup-id': 'error',
    'no-dup-attr': 'error',
    deprecated: 'error',
    'no-deprecated-attr': 'error'
  }
})
const checkHtml = async (page: Page): Promise<string[]> => {
  const report = await htmlvalidate.validateString(await page.content())
  return report.results.flatMap((r) => r.messages.map((m) => `html ${m.severity === 2 ? 'error' : 'warning'}: ${m.message} (${m.ruleId}, line ${m.line})`))
}

// Collects console/page errors seen while `body` runs, plus HTML validation of the page it leaves behind,
// and visits them under `name` in the report.
const check = async (page: Page, name: string, body: () => Promise<void>) => {
  const errors: string[] = []
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text())
  }
  const onPageError = (err: unknown) => errors.push(err instanceof Error ? err.message : String(err))
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  try {
    await body()
  } catch (e) {
    errors.push(`check itself failed: ${e instanceof Error ? e.message : e}`)
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }
  try {
    errors.push(...(await checkHtml(page)))
  } catch (e) {
    errors.push(`html validation itself failed: ${e instanceof Error ? e.message : e}`)
  }
  results.push({ name, errors })
  console.log(errors.length ? `FAIL  ${name}` : `ok    ${name}`)
  for (const e of errors) console.log(`        ${e}`)
}

// Chrome upgrades plain-http navigations to a custom hostname (but not to an IP) to https by itself, which then
// fails against this plain-http app. Browser navigation therefore goes to the resolved IP instead.
let browserUrl = APP_URL
const resolveBrowserUrl = async () => {
  const url = new URL(APP_URL)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return
  url.hostname = (await lookup(url.hostname)).address
  browserUrl = url.toString().replace(/\/$/, '')
}

const goto = async (page: Page, hash: string) => {
  // Not 'networkidle0': the app keeps an SSE connection (/api/live) open, so the network never goes idle.
  await page.goto(`${browserUrl}/${hash}`, { waitUntil: 'load' })
  await new Promise((r) => setTimeout(r, 500)) // let watchers/effects settle
}

const sidebarSections = async (page: Page): Promise<string[]> =>
  page.$$eval('.sidebar button.ui, .sidebar button.jd:not(.nested)', (buttons) => buttons.map((b) => b.textContent?.trim() ?? ''))

const main = async () => {
  const devices = await api('/api/devices')
  const device = devices.find((d: { id: string; name: string; online?: boolean }) => d.id === DEVICE || d.name === DEVICE)
  if (!device) {
    console.error(`Device "${DEVICE}" not found. Start it with testing/devices/run.sh up.`)
    process.exit(1)
  }
  if (device.online === false) {
    console.error(`Device "${DEVICE}" is offline.`)
    process.exit(1)
  }

  await resolveBrowserUrl()
  let browser: Browser | undefined
  try {
    browser = await puppeteer.launch({
      executablePath: findChromium(),
      headless: true,
      // Chrome's automatic HTTPS upgrade otherwise tries TLS against the app's plain-http port.
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-features=HttpsUpgrades']
    })
    const page = await browser.newPage()
    if (UI_PASSWORD) await page.authenticate({ username: 'ui-check', password: UI_PASSWORD })
    await page.setViewport({ width: 1280, height: 900 })

    await check(page, 'Downloads', () => goto(page, `#downloads?device=${device.id}`))
    await check(page, 'Downloads (all devices)', () => goto(page, `#downloads?device=all`))
    await check(page, 'Linkgrabber', () => goto(page, `#linkgrabber?device=${device.id}`))

    // .device-tab (which opens the overlay DeviceDialog) only exists on the phone-width nav; on desktop the
    // header's DevicePicker dropdown is the way to switch devices.
    await check(page, 'Device picker', async () => {
      await goto(page, `#downloads?device=${device.id}`)
      await page.click('.header-picker button.trigger')
      await page.waitForSelector('.header-picker .menu', { timeout: 5000 })
      await page.click('.header-picker button.trigger')
    })

    // Settings: visit every sidebar section once (the list itself reflects what SECTIONS in settings.ts holds).
    await goto(page, `#settings?device=${device.id}`)
    await page.waitForSelector('.sidebar', { timeout: 5000 })
    const sections = await sidebarSections(page)
    for (let i = 0; i < sections.length; i++) {
      await check(page, `Settings: ${sections[i]}`, async () => {
        const buttons = await page.$$('.sidebar button.ui, .sidebar button.jd:not(.nested)')
        await buttons[i].click()
        await new Promise((r) => setTimeout(r, 300))
      })
    }

    // Add-links dialog -> linkgrabber -> context menu -> remove again, so nothing is left behind.
    await check(page, 'Add links dialog', async () => {
      await goto(page, `#downloads?device=${device.id}`)
      await page.click('.statusbar button.add')
      await page.waitForSelector('form.add textarea', { timeout: 5000 })
      await page.type('form.add textarea', TEST_LINK)
      await page.type('form.add input[placeholder="Package name"]', TEST_PACKAGE_NAME)
      await page.click('form.add button.primary')
      await page.waitForSelector('.gpackage', { timeout: 15000 })
    })

    await check(page, 'Linkgrabber context menu', async () => {
      const head = await page.waitForSelector('.gpackage > .head', { timeout: 5000 })
      const box = await head?.boundingBox()
      if (!box) throw new Error('package header not found')
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
      await page.waitForSelector('.backdrop .menu', { timeout: 5000 })
      await page.click('.backdrop')
    })

    // Clean-up via the API directly: faster and does not depend on the context menu having worked.
    const grabberState = await api(`/api/linkgrabber?device=${device.id}`)
    const addedPackageId = grabberState.packages.find((p: { name: string; uuid: number }) => p.name === TEST_PACKAGE_NAME)?.uuid
    if (addedPackageId !== undefined) {
      await api('/api/linkgrabber/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packageIds: [addedPackageId], device: device.id }) })
    }
  } finally {
    await browser?.close()
  }

  const failed = results.filter((r) => r.errors.length)
  console.log(`\n${results.length - failed.length}/${results.length} ok`)
  process.exit(failed.length ? 1 : 0)
}

await main()
