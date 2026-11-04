import { VERSION } from './version.js'

// Whether this backend itself (the Docker image) is behind the latest GitHub release. Unlike the browser extension and the Android
// app, the backend cannot be fetched and installed from here: it just tells the user, with the command to run by hand (see the
// settings page). Checked against the public GitHub API, cached for a while so opening the settings does not call out every time.
const REPO = 'bennyborn/my-own-jdownloader'
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`
const CHECK_INTERVAL = 6 * 60 * 60 * 1000

export interface BackendUpdateInfo {
  current: string
  latest: string | null
  update: string | null // the newer version, or null when none is available
  url: string | null // the GitHub release page
  notes: string | null // the release's own changelog text (Markdown, as GitHub generated it)
  checkedAt: number
}

const isNewer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number))
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

let cached: BackendUpdateInfo | null = null
let cachedAt = 0

export const checkBackendUpdate = async (force = false): Promise<BackendUpdateInfo> => {
  if (!force && cached && Date.now() - cachedAt < CHECK_INTERVAL) return cached
  cachedAt = Date.now()
  try {
    const res = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'my-own-jdownloader' } })
    if (!res.ok) throw new Error(`GitHub: HTTP ${res.status}`)
    const data = (await res.json()) as { tag_name?: string; html_url?: string; body?: string }
    const latest = (data.tag_name ?? '').replace(/^v/, '') || null
    cached = {
      current: VERSION,
      latest,
      update: latest && VERSION !== 'dev' && isNewer(latest, VERSION) ? latest : null,
      url: data.html_url ?? null,
      notes: data.body ?? null,
      checkedAt: Date.now()
    }
  } catch {
    // keep whatever we had before rather than flapping to "no update" on a hiccup; only a first-ever check becomes an empty result
    cached ??= { current: VERSION, latest: null, update: null, url: null, notes: null, checkedAt: Date.now() }
  }
  return cached
}
