import { withDevice } from './devices'
import { onMounted, onUnmounted, ref } from 'vue'

const CONTAINER_EXTENSIONS = ['dlc', 'ccf', 'rsdf', 'jdc', 'metalink', 'meta4']
const isTextFile = (f: File) => f.type === 'text/plain' || f.name.split('.').pop()?.toLowerCase() === 'txt'

const readAsDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(f)
  })

const post = async (url: string, body: unknown) => {
  const res = await fetch(withDevice(url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      message = (await res.json()).error ?? message
    } catch {
      /* keep the status text */
    }
    throw new Error(message)
  }
}

// Drop container files (DLC etc.) or links dragged from another page anywhere onto the window; a text file
// is handed to onText (opens the add-links dialog prefilled) instead of being added right away.
// Our own drag and drop reordering only carries text/plain, so it never triggers the overlay.
export const useFileDrop = (onAdded: () => void, onError: (message: string) => void, onFailed: () => void, onText: (text: string) => void) => {
  const active = ref(false)
  let depth = 0

  const carriesExternal = (e: DragEvent) => {
    const types = e.dataTransfer?.types ?? []
    return types.includes('Files') || types.includes('text/uri-list')
  }

  // While dragging, browsers only reveal the MIME type, not the file name. Container files have no
  // registered type (empty / octet-stream) apart from metalink, so files of any other known type
  // (images, PDFs, ...) get no overlay. The extension is checked on drop.
  const MAYBE_CONTAINER = /^(|application\/octet-stream|application\/metalink4?\+xml|text\/plain)$/
  const looksDroppable = (e: DragEvent) => {
    const items = [...(e.dataTransfer?.items ?? [])]
    const files = items.filter((i) => i.kind === 'file')
    return files.length === 0 || files.some((i) => MAYBE_CONTAINER.test(i.type))
  }

  const onDragEnter = (e: DragEvent) => {
    if (!carriesExternal(e)) return
    depth++
    if (looksDroppable(e)) active.value = true
  }
  const onDragOver = (e: DragEvent) => {
    if (!carriesExternal(e)) return
    e.preventDefault() // required to allow dropping
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }
  const onDragLeave = (e: DragEvent) => {
    if (!carriesExternal(e)) return
    depth = Math.max(0, depth - 1)
    if (depth === 0) active.value = false
  }
  const onDrop = async (e: DragEvent) => {
    if (!carriesExternal(e)) return
    e.preventDefault()
    depth = 0
    active.value = false
    const files = [...(e.dataTransfer?.files ?? [])]
    const uris = (e.dataTransfer?.getData('text/uri-list') ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
    const textFiles = files.filter(isTextFile)
    const containerFiles = files.filter((f) => CONTAINER_EXTENSIONS.includes(f.name.split('.').pop()?.toLowerCase() ?? ''))
    const unsupported = files.find((f) => !textFiles.includes(f) && !containerFiles.includes(f))
    if (unsupported) {
      onError(`"${unsupported.name}" is neither a text file nor a supported container file (${CONTAINER_EXTENSIONS.join(', ')})`)
      return
    }
    // A text file opens the add-links dialog prefilled instead of being added right away.
    if (textFiles.length) {
      const texts = await Promise.all(textFiles.map((f) => f.text()))
      onText(texts.join('\n'))
    }
    if (!containerFiles.length && !uris.length) return
    // Switch to the linkgrabber right away so the new entries show up as soon as JD reports them.
    onAdded()
    try {
      for (const file of containerFiles) {
        await post('/api/linkgrabber/add-container', { filename: file.name, dataUrl: await readAsDataUrl(file) })
      }
      if (!containerFiles.length && uris.length) await post('/api/linkgrabber/add', { links: uris.join('\n'), autostart: false })
      onAdded()
    } catch (err) {
      onFailed()
      onError(`Adding failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  onMounted(() => {
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
  })
  onUnmounted(() => {
    window.removeEventListener('dragenter', onDragEnter)
    window.removeEventListener('dragover', onDragOver)
    window.removeEventListener('dragleave', onDragLeave)
    window.removeEventListener('drop', onDrop)
  })

  return { active }
}
