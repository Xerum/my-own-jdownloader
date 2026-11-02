// Right-click entries that send links to the linkgrabber of the Click'n'Load device (never straight to the downloads).
// The links take the Click'n'Load route, so the same card appears on the page (device choice, result, numbers).
const MENUS = [
  { id: 'send-link', title: 'Send link to JDownloader', contexts: ['link'] },
  { id: 'send-selection', title: 'Send selected links to JDownloader', contexts: ['selection'] },
  { id: 'send-page', title: 'Send this page to JDownloader', contexts: ['page', 'video', 'audio'] }
]

const createMenus = () => {
  chrome.contextMenus.removeAll(() => {
    for (const menu of MENUS) chrome.contextMenus.create(menu)
  })
}

const linksFor = (info) => {
  if (info.menuItemId === 'send-link') return info.linkUrl
  if (info.menuItemId === 'send-selection') return info.selectionText
  return info.srcUrl && /^https?:/.test(info.srcUrl) && (info.mediaType === 'video' || info.mediaType === 'audio') ? info.srcUrl : info.pageUrl
}

export const initContextMenu = (sendCnl) => {
  chrome.runtime.onInstalled.addListener(createMenus)
  chrome.runtime.onStartup?.addListener(createMenus)

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!MENUS.some((menu) => menu.id === info.menuItemId)) return
    const urls = linksFor(info)?.trim()
    if (!urls) return
    // Pages the extension cannot draw on (browser pages, the store) get a notification instead of the card.
    if (tab?.id === undefined || !/^https?:/.test(tab.url ?? '')) {
      chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'My Own JDownloader', message: 'Sent to the linkgrabber.' })
    }
    await sendCnl({ urls, source: tab?.url }, tab?.id, undefined, true)
  })
}
