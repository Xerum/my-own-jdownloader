import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The version of the project: the file VERSION at the repository root, which is /app/VERSION in the image.
export const VERSION = (() => {
  try {
    return readFileSync(fileURLToPath(new URL('../../VERSION', import.meta.url)), 'utf8').trim() || 'dev'
  } catch {
    return 'dev'
  }
})()
