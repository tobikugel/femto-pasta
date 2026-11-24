<script setup lang="ts">
defineProps<{ label: string, value: string | number, note?: string, accent?: string }>()
</script>

<template>
  <div class="tile" :style="accent ? { '--accent': accent } : {}">
    <div class="label">{{ label }}</div>
    <div class="value num">{{ value }}</div>
    <div v-if="note" class="sub">{{ note }}</div>
  </div>
</template>

<style scoped>
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; position: relative; overflow: hidden; }
.tile::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent, var(--pesto)); }
.label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
.value { font-size: 26px; font-weight: 800; line-height: 1.2; margin: 2px 0; }
</style>
