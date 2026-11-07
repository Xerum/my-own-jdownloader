<script setup lang="ts">
import { computed } from 'vue'
import { clearDownloadMarks, markPackages, packageMarkState, selectedDownloadPackages } from './expandedState'

// "All" checkbox of a download list: marks every package of that list (like ctrl+click on each), so the context menu
// of a marked package acts on all of them. device: '' for the single-device view, else the device of the overview section.
const props = defineProps<{ device: string; ids: number[] }>()

const state = computed(() => packageMarkState(props.device, props.ids))
const count = computed(() => (state.value === 'none' ? 0 : props.ids.filter((id) => selectedDownloadPackages.value.has(id)).length))
const toggle = () => (state.value === 'all' ? clearDownloadMarks() : markPackages(props.device, props.ids))
const indeterminate = (el: HTMLInputElement | null) => {
  if (el) el.indeterminate = state.value === 'some'
}
</script>

<template>
  <span class="select-all">
    <label class="check" title="Mark all packages (Ctrl+A); right-click a marked package for actions">
      <input type="checkbox" :checked="state === 'all'" :ref="(el) => indeterminate(el as HTMLInputElement)" :disabled="!ids.length" @change="toggle" />
      All
    </label>
    <span v-if="count" class="count">{{ count }} of {{ ids.length }} marked</span>
  </span>
</template>

<style scoped>
.select-all { display: inline-flex; align-items: center; gap: 14px; font-size: 0.9rem; font-weight: 400; }
.check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.count { color: var(--muted); font-size: 0.85rem; font-variant-numeric: tabular-nums; }
</style>
