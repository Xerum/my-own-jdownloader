<script setup lang="ts">
import { X } from '@lucide/vue'
import { nextTick, ref, watch } from 'vue'
import { withDevice } from './devices'

// Only shown for a specific device (never in the "all devices" overview), so JD's speed limit can be
// adjusted on the fly from the status bar while it's throttling downloads.
const props = defineProps<{ device: string; speedLimit: number }>()
const emit = defineEmits<{ saved: [speedLimit: number] }>()
const open = defineModel<boolean>({ required: true })

const UNITS = { 'KB/s': 1024, 'MB/s': 1024 * 1024 } as const
type Unit = keyof typeof UNITS

const enabled = ref(false)
const amount = ref(1024)
const unit = ref<Unit>('KB/s')
const saving = ref(false)
const error = ref('')
const field = ref<HTMLInputElement | null>(null)

watch(open, async (v) => {
  if (!v) return
  enabled.value = props.speedLimit > 0
  // MB/s when the stored limit lands on a round number of them, otherwise KB/s.
  if (props.speedLimit > 0 && props.speedLimit % UNITS['MB/s'] === 0) {
    unit.value = 'MB/s'
    amount.value = props.speedLimit / UNITS['MB/s']
  } else if (props.speedLimit > 0) {
    unit.value = 'KB/s'
    amount.value = Math.max(1, Math.round(props.speedLimit / UNITS['KB/s']))
  }
  error.value = ''
  await nextTick()
  field.value?.focus()
})

const setConfig = async (key: string, value: unknown): Promise<void> => {
  const res = await fetch(withDevice('/api/jd-config', props.device), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interfaceName: 'org.jdownloader.settings.GeneralSettings', storage: null, key, value })
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
}

const save = async (): Promise<void> => {
  saving.value = true
  error.value = ''
  try {
    const bps = Math.max(1, Math.round(amount.value * UNITS[unit.value]))
    await setConfig('DownloadSpeedLimit', bps)
    await setConfig('DownloadSpeedLimitEnabled', enabled.value)
    emit('saved', enabled.value ? bps : 0)
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="open" class="overlay" role="dialog" aria-modal="true" aria-label="Speed limit" @click.self="open = false" @keydown.esc="open = false">
    <form class="dialog" @submit.prevent="save">
      <div class="head">
        <h3>Speed limit</h3>
        <button type="button" class="close" title="Close" @click="open = false"><X :size="18" /></button>
      </div>
      <label class="toggle"><input v-model="enabled" type="checkbox" /> Limit download speed</label>
      <label class="field">
        <span>Limit</span>
        <span class="input-group">
          <input ref="field" v-model.number="amount" type="number" min="1" step="1" inputmode="numeric" />
          <select v-model="unit">
            <option v-for="u in Object.keys(UNITS) as Unit[]" :key="u" :value="u">{{ u }}</option>
          </select>
        </span>
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="button" @click="open = false">Cancel</button>
        <button type="submit" class="primary" :disabled="saving || (enabled && (!amount || amount < 1))">{{ saving ? 'Saving…' : 'Save' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 400; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(var(--overlay-blur)); -webkit-backdrop-filter: blur(var(--overlay-blur)); }
.dialog { display: grid; gap: 14px; width: min(360px, 100%); padding: 20px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4); }
.head { display: flex; align-items: center; justify-content: space-between; }
h3 { margin: 0; font-size: 1rem; }
.close { display: inline-flex; padding: 6px; background: none; border: 0; color: var(--muted); cursor: pointer; }
.toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.field { display: grid; gap: 6px; }
.field > span:first-child { font-size: 0.8rem; color: var(--muted); }
.input-group { display: flex; align-items: center; gap: 8px; }
input[type='number'] { box-sizing: border-box; width: 100%; padding: 9px 12px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; font: inherit; }
input[type='number']:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
select { flex: none; padding: 9px 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; font: inherit; }
.error { margin: 0; color: #d14343; }
.actions { display: flex; justify-content: flex-end; gap: 10px; }
button { padding: 7px 16px; background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 6px; font: inherit; cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button:disabled { opacity: 0.5; cursor: default; }
</style>
