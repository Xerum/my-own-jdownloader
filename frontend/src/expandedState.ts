import { ref, watch } from 'vue'

// Which packages are open. Lives at module level so it survives tab switches (the views are unmounted
// then), and in the sessionStorage so it also survives a reload of the page (but not a new browser tab).
const load = (key: string): Set<number> => {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter(Number.isSafeInteger) : [])
  } catch {
    return new Set()
  }
}
const save = (key: string, ids: Set<number>) => {
  try {
    sessionStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    /* private mode or storage full: the state is just not remembered */
  }
}

export const expandedDownloads = load('expandedDownloads')
export const saveExpandedDownloads = () => save('expandedDownloads', expandedDownloads)
export const expandedGrabber = ref<Set<number>>(load('expandedGrabber'))
watch(expandedGrabber, (ids) => save('expandedGrabber', ids))

// Packages marked with ctrl+click in the download list (merge candidates).
export const selectedDownloadPackages = ref<Set<number>>(new Set())
// The device the marked packages belong to: the overview shows several lists, but marks never span devices.
export const selectedPackagesDevice = ref('')

// Links marked in the download list (click, ctrl+click, shift+click); the context menu then acts on all of them.
export const selectedDownloadLinks = ref<Set<number>>(new Set())
// Where the last plain/ctrl click happened: the start of a shift+click range (ranges stay inside one package).
export const linkAnchor = ref<{ package: number; link: number } | null>(null)
// Where the last ctrl click on a package header happened: the start of a shift+click range of packages.
export const packageAnchor = ref<{ device: string; package: number } | null>(null)

// Marks exactly these packages of one device's list (select all, shift+click range); link marks are dropped.
export const markPackages = (device: string, ids: Iterable<number>) => {
  selectedPackagesDevice.value = device
  selectedDownloadPackages.value = new Set(ids)
  if (selectedDownloadLinks.value.size) selectedDownloadLinks.value = new Set()
}
export const clearDownloadMarks = () => {
  if (selectedDownloadLinks.value.size) selectedDownloadLinks.value = new Set()
  if (selectedDownloadPackages.value.size) selectedDownloadPackages.value = new Set()
}
// How many of these packages are marked: 'none', 'some' or 'all' (for the "All" checkbox).
export const packageMarkState = (device: string, ids: number[]): 'none' | 'some' | 'all' => {
  if (selectedPackagesDevice.value !== device) return 'none'
  const count = ids.filter((id) => selectedDownloadPackages.value.has(id)).length
  return count === 0 ? 'none' : count === ids.length ? 'all' : 'some'
}
