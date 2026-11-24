<script setup lang="ts">
// The ranking: total servings with share bar, attendance, streaks
import type { PersonStats } from '~/lib/stats'
import { fmt } from '~/lib/stats'

const props = defineProps<{ people: PersonStats[] }>()
const max = computed(() => Math.max(1, ...props.people.map(p => p.servings)))
const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`
</script>

<template>
  <div class="scroll-x">
    <table class="data">
      <thead>
        <tr>
          <th />
          <th>eater</th>
          <th>servings</th>
          <th class="r">share</th>
          <th class="r">visits</th>
          <th class="r" title="visits / pasta days since the first visit">attendance</th>
          <th class="r">⌀ / visit</th>
          <th class="r">max</th>
          <th class="r" title="longest run of consecutive pasta days (current run)">streak</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(p, i) in people.filter(p => p.days > 0)" :key="p.name">
          <td class="rank">{{ medal(i) }}</td>
          <td class="name">{{ p.name }}</td>
          <td class="barcell">
            <span class="bar" :style="{ width: `${(p.servings / max) * 100}%` }" />
            <span class="num">{{ fmt(p.servings) }}</span>
          </td>
          <td class="r num">{{ (p.share * 100).toFixed(1) }} %</td>
          <td class="r num">{{ p.days }}</td>
          <td class="r num">{{ Math.round(p.attendance * 100) }} %</td>
          <td class="r num">{{ fmt(p.mean) }}</td>
          <td class="r num">{{ fmt(p.max) }}</td>
          <td class="r num">{{ p.longestStreak }}<span v-if="p.currentStreak" class="cur"> ({{ p.currentStreak }}🔥)</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.rank { width: 2.5em; color: var(--muted); }
.name { font-weight: 600; white-space: nowrap; }
.barcell { min-width: 160px; display: flex; align-items: center; gap: 8px; }
.bar { display: inline-block; height: 10px; border-radius: 0 4px 4px 0; background: var(--pesto); min-width: 2px; flex: 0 0 auto; max-width: calc(100% - 3em); }
.cur { color: var(--parmesan); }
td { white-space: nowrap; }
</style>
