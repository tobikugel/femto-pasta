<script setup lang="ts">
import type { Badge } from '~/lib/stats'
defineProps<{ badges: Badge[] }>()
</script>

<template>
  <div class="wall">
    <div v-for="b in badges" :key="b.title" class="badge">
      <span class="icon" aria-hidden="true">{{ b.icon }}</span>
      <div>
        <div class="title">{{ b.title }}</div>
        <div class="who">{{ b.who }}</div>
        <div class="sub">{{ b.why }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wall { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
.badge { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); }
.icon { font-size: 26px; line-height: 1; }
.title { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--parmesan); }
.who { font-weight: 800; }
</style>
