<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ArrowUpCircle, CheckCircle2 } from '@lucide/vue'
import { backendUpdate, checkingBackendUpdate, loadBackendUpdate } from './backendUpdate'

onMounted(() => {
  if (!backendUpdate.value) void loadBackendUpdate()
})

const pullCommand = 'docker compose pull app && docker compose up -d app'
</script>

<template>
  <div class="update-page">
    <p class="hint">This interface runs as a Docker container, built from the public image on GitHub. It cannot update itself: when a newer version is out, this page tells you, with the command to run.</p>

    <div v-if="backendUpdate?.update" class="offer">
      <ArrowUpCircle :size="20" />
      <div class="text">
        <p class="headline">Version {{ backendUpdate.update }} is available (you are running {{ backendUpdate.current }}).</p>
        <p v-if="backendUpdate.notes" class="notes">{{ backendUpdate.notes }}</p>
        <a v-if="backendUpdate.url" :href="backendUpdate.url" target="_blank" rel="noopener">See the release on GitHub</a>
      </div>
    </div>
    <p v-else-if="backendUpdate" class="state ok"><CheckCircle2 :size="16" /> You are running the newest version ({{ backendUpdate.current }}).</p>
    <p v-else class="hint">Looking for a newer version …</p>

    <div class="field">
      <span>Update it</span>
      <pre>{{ pullCommand }}</pre>
      <p class="hint">Run this next to your compose.yaml. If you pinned <code>APP_VERSION</code> in your .env, set it to the new version first (or remove it to always get the latest).</p>
    </div>

    <div class="buttons">
      <button type="button" class="save" :disabled="checkingBackendUpdate" @click="loadBackendUpdate(true)">Check now</button>
    </div>
  </div>
</template>

<style scoped>
.update-page { display: grid; gap: 16px; }
.hint { margin: 0; color: var(--muted); font-size: 0.85rem; line-height: 1.5; }
.field { display: grid; gap: 6px; font-weight: 600; }
.offer { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; background: color-mix(in srgb, var(--extract) 14%, transparent); border: 1px solid color-mix(in srgb, var(--extract) 50%, transparent); border-radius: 8px; }
.offer svg { flex: none; color: var(--extract); margin-top: 1px; }
.offer .headline { margin: 0 0 6px; font-weight: 600; }
.offer .notes { margin: 0 0 8px; white-space: pre-wrap; color: var(--muted); font-size: 0.85rem; max-height: 220px; overflow-y: auto; }
.offer a { color: var(--extract-text); font-weight: 600; }
.state { display: flex; align-items: center; gap: 8px; margin: 0; }
.state.ok { color: var(--ok); }
pre { margin: 0; padding: 8px 10px; overflow-x: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem; }
.save { padding: 8px 18px; background: var(--accent); color: #fff; border: 0; border-radius: 6px; font: inherit; cursor: pointer; }
.save:disabled { opacity: 0.5; cursor: default; }
</style>
