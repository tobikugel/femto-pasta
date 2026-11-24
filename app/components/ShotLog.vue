<script setup lang="ts">
// The latest submissions as a shot log (pulse number, date, eater, servings)
import type { PastaEntry } from '#shared/types/pasta'
import { fmt } from '~/lib/stats'

const props = defineProps<{ entries: PastaEntry[] }>()
const n = ref(12)
// shot number: position of the entry in the whole log, oldest first
const shotNo = computed(() => new Map([...props.entries].sort((a, b) => a.date.localeCompare(b.date) || (a.at ?? '').localeCompare(b.at ?? '')).map((e, i) => [e, i + 1])))
const latest = computed(() => [...props.entries].sort((a, b) => (shotNo.value.get(b) ?? 0) - (shotNo.value.get(a) ?? 0)).slice(0, n.value))
const shot = (e: PastaEntry) => `#${String(shotNo.value.get(e) ?? 0).padStart(4, '0')}`
</script>

<template>
  <div class="log">
    <div v-for="e in latest" :key="`${e.date}${e.name}`" class="line">
      <span class="h">{{ shot(e) }}</span>
      <span class="d">{{ e.date }}</span>
      <span class="who">{{ e.name }}</span>
      <span class="op">{{ fmt(e.servings) }} serving{{ e.servings === 1 ? '' : 's' }}</span>
      <span v-if="e.source === 'excel'" class="tag">from the Excel list</span>
    </div>
    <button v-if="entries.length > n" class="ghost more" @click="n += 30">Show more shots</button>
  </div>
</template>

<style scoped>
.log { font-size: 12.5px; }
.line { display: flex; gap: 10px; white-space: nowrap; overflow: hidden; padding: 2px 0; }
.h { color: var(--hene); font-family: var(--mono); }
.d { font-family: var(--mono); }
.d { color: var(--muted); }
.who { color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.op { color: var(--pesto); }
.tag { color: var(--muted); }
.more { margin-top: 8px; font-size: 12px; }
</style>
