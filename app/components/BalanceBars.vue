<script setup lang="ts">
// Balance per person around zero: credit to the right, debt to the left (sign also in the label)
import type { Account } from '~/lib/credits'
import { euro } from '~/lib/credits'

const props = defineProps<{ accounts: Account[] }>()
const max = computed(() => Math.max(1, ...props.accounts.map(a => Math.abs(a.balance))))
const pct = (x: number) => `${(Math.abs(x) / max.value) * 50}%`
</script>

<template>
  <div class="bars" role="img" aria-label="Balance per person">
    <div v-for="a in accounts" :key="a.name" class="row">
      <div class="name">{{ a.name }}</div>
      <div class="track">
        <span class="zero" />
        <span v-if="a.balance < 0" class="bar neg" :style="{ width: pct(a.balance), right: '50%' }" />
        <span v-else-if="a.balance > 0" class="bar pos" :style="{ width: pct(a.balance), left: '50%' }" />
      </div>
      <div class="val num" :class="{ neg: a.balance < 0 }">{{ euro(a.balance, true) }}</div>
    </div>
    <div class="axis sub"><span>← owes</span><span>in credit →</span></div>
  </div>
</template>

<style scoped>
.row { display: grid; grid-template-columns: minmax(90px, 170px) 1fr 86px; gap: 10px; align-items: center; padding: 3px 0; }
.name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-2); font-size: 12.5px; text-align: right; }
.track { position: relative; height: 16px; }
.zero { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--muted); }
.bar { position: absolute; top: 2px; height: 12px; min-width: 2px; }
.bar.pos { background: var(--s1); border-radius: 0 4px 4px 0; }
.bar.neg { background: var(--s2); border-radius: 4px 0 0 4px; }
.val { text-align: right; font-size: 12.5px; font-weight: 600; }
.val.neg { color: var(--tomato); }
.axis { display: grid; grid-template-columns: minmax(90px, 170px) 1fr 1fr 86px; gap: 10px; margin-top: 6px; }
.axis span:first-child { grid-column: 2; text-align: right; padding-right: 8px; }
.axis span:last-child { grid-column: 3; padding-left: 8px; }
@media (max-width: 600px) { .row { grid-template-columns: 90px 1fr 76px; } .axis { grid-template-columns: 90px 1fr 1fr 76px; } }
</style>
