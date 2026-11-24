<script setup lang="ts">
// The latest submissions, styled like `git log --oneline`
import type { PastaEntry } from '#shared/types/pasta'
import { fmt } from '~/lib/stats'

const props = defineProps<{ entries: PastaEntry[] }>()
const n = ref(12)
const latest = computed(() => [...props.entries].sort((a, b) => (b.at ?? b.date).localeCompare(a.at ?? a.date) || b.date.localeCompare(a.date)).slice(0, n.value))
// a fake but stable short "hash" per entry
function hash(e: PastaEntry) {
  let h = 2166136261
  for (const c of `${e.date}${e.name}${e.servings}${e.at ?? ''}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}
</script>

<template>
  <div class="log">
    <div v-for="e in latest" :key="`${e.date}${e.name}`" class="line">
      <span class="h">{{ hash(e) }}</span>
      <span class="d">{{ e.date }}</span>
      <span class="who">{{ e.name }}</span>
      <span class="op">+= {{ fmt(e.servings) }}</span>
      <span v-if="e.source === 'excel'" class="tag">(excel import)</span>
    </div>
    <button v-if="entries.length > n" class="ghost more" @click="n += 30">git log --more</button>
  </div>
</template>

<style scoped>
.log { font-size: 12.5px; }
.line { display: flex; gap: 10px; white-space: nowrap; overflow: hidden; padding: 2px 0; }
.h { color: var(--parmesan); }
.d { color: var(--muted); }
.who { color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.op { color: var(--pesto); }
.tag { color: var(--muted); }
.more { margin-top: 8px; font-size: 12px; }
</style>
