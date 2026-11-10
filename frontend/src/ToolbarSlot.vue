<script setup lang="ts">
import { computed } from 'vue'
import { entriesOf } from './plugins'

// A named block outside any package, e.g. a toolbar row above a list. Unlike PackageSlot, there is no per-item
// data to fetch: a plugin's component gets only the scope it was mounted for.
const props = defineProps<{ name: string; scope?: string }>()
defineOptions({ inheritAttrs: false })

const entries = computed(() => entriesOf(props.name))
const before = computed(() => entries.value.filter((e) => e.mode === 'prepend'))
const after = computed(() => entries.value.filter((e) => e.mode === 'append'))
const replacing = computed(() => entries.value.filter((e) => e.mode === 'replace').at(-1))
</script>

<template>
  <component :is="e.component" v-for="e in before" :key="`b${e.pluginId}`" :scope="scope" />
  <component :is="replacing.component" v-if="replacing" :scope="scope"><slot /></component>
  <slot v-else />
  <component :is="e.component" v-for="e in after" :key="`a${e.pluginId}`" :scope="scope" />
</template>
