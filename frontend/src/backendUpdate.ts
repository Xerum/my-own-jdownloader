import { computed, onMounted, onUnmounted, ref } from 'vue'

export interface BackendUpdateInfo {
  current: string
  latest: string | null
  update: string | null
  url: string | null
  notes: string | null
  checkedAt: number
}

// Whether this backend (the Docker image) is behind the latest GitHub release. The backend itself caches the GitHub lookup for
// hours, so polling here only keeps the UI in sync with that, it does not call out on its own.
export const backendUpdate = ref<BackendUpdateInfo | null>(null)
export const backendUpdateAvailable = computed(() => !!backendUpdate.value?.update)
export const checkingBackendUpdate = ref(false)

export const loadBackendUpdate = async (force = false) => {
  checkingBackendUpdate.value = true
  try {
    const res = await fetch(force ? '/api/backend-update?force=1' : '/api/backend-update')
    if (res.ok) backendUpdate.value = await res.json()
  } catch {
    /* the old answer stays */
  } finally {
    checkingBackendUpdate.value = false
  }
}

export const useBackendUpdate = () => {
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    void loadBackendUpdate()
    timer = setInterval(() => !document.hidden && loadBackendUpdate(), 60 * 60_000)
  })
  onUnmounted(() => clearInterval(timer))
}
