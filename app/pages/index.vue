<script setup lang="ts">
import { computeStats, fmt } from '~/lib/stats'
import { shortDate } from '~/lib/scale'

const { log, error, loading, load } = usePasta()
const { clear } = useUserSession()
onMounted(load)

const stats = computed(() => (log.value ? computeStats(log.value) : null))
const dates = computed(() => stats.value?.days.map(d => d.date) ?? [])
const top5 = computed(() => stats.value?.people.filter(p => p.days > 0).slice(0, 5).map(p => p.name) ?? [])
const heatNames = computed(() => stats.value?.people.filter(p => p.days > 0).map(p => p.name) ?? [])

/** how few top eaters eat half of everything */
const busFactor = computed(() => {
  let acc = 0
  const ps = stats.value?.people.filter(p => p.servings > 0) ?? []
  for (let i = 0; i < ps.length; i++) if ((acc += ps[i]!.share) >= 0.5) return i + 1
  return 0
})

const quotes = [
  'Al dente is a boundary condition.',
  'Pasta is conserved. Mostly.',
  'Σ servings → ∞ as t → Wednesday.',
  'Heisenberg: you can know the sauce or the shape, never both.',
  'Pulse duration: 30 fs. Lunch duration: 30 min.',
  'Spaghetti are just very long, very slow photons.',
]
const quote = quotes[Math.floor(Date.now() / 86_400_000) % quotes.length]

async function logout() {
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="wrap">
    <header class="top">
      <div class="brand">
        <span class="logo" aria-hidden="true">🍝</span>
        <div>
          <h1>femto<span class="accent">-pasta</span></h1>
          <div class="sub">// {{ quote }}</div>
        </div>
      </div>
      <nav class="no-print">
        <button class="ghost" :disabled="loading" title="reload" @click="load">⟳ fetch</button>
        <NuxtLink to="/qr" class="btn ghost">▦ QR</NuxtLink>
        <button class="ghost" @click="logout">exit</button>
      </nav>
    </header>

    <p v-if="error" class="card err">error: {{ error }}</p>

    <SubmitPanel />

    <template v-if="stats">
      <div class="grid tiles section">
        <StatTile label="Σ servings" :value="fmt(stats.total)" :note="`${stats.entries} plates logged`" />
        <StatTile label="pasta days" :value="stats.days.length" :note="stats.days.length ? `since ${shortDate(stats.days[0]!.date, true)}` : '—'" accent="var(--s1)" />
        <StatTile label="⌀ per Wednesday" :value="fmt(stats.meanPerDay, 1)" :note="`${fmt(stats.meanEatersPerDay, 1)} eaters on average`" accent="var(--s3)" />
        <StatTile label="⟨servings⟩ ± σ" :value="`${fmt(stats.meanPerEntry)} ± ${fmt(stats.stdPerEntry)}`" :note="`median ${fmt(stats.medianPerEntry)}`" accent="var(--parmesan)" />
        <StatTile label="record day" :value="stats.recordDay ? fmt(stats.recordDay.servings) : '—'" :note="stats.recordDay ? shortDate(stats.recordDay.date, true) : ''" accent="var(--s2)" />
        <StatTile label="dP/dt" :value="`${fmt(stats.trendPerWeek, 1)} /wk`" :note="stats.nextMilestone?.date ? `${stats.nextMilestone.value} servings ≈ ${shortDate(stats.nextMilestone.date, true)} (R² = ${fmt(stats.trendR2)})` : 'need more data'" accent="var(--s5)" />
      </div>

      <section class="card section">
        <h2>servings per Wednesday</h2>
        <WeeklyBars :days="stats.days" :mean="stats.meanPerDay" />
      </section>

      <div class="grid cols-2 section">
        <section class="card">
          <h2>the pasta race</h2>
          <CumulativeLines :entries="log!.entries" :dates="dates" :names="top5" />
        </section>
        <section class="card">
          <h2>servings per visit</h2>
          <ServingsHistogram :histogram="stats.histogram" :mean="stats.meanPerEntry" :std="stats.stdPerEntry" />
        </section>
      </div>

      <section class="card section">
        <h2>leaderboard</h2>
        <Leaderboard :people="stats.people" />
      </section>

      <section class="card section">
        <h2>hall of fame</h2>
        <BadgeWall :badges="stats.badges" />
      </section>

      <div class="grid cols-3 section">
        <StatTile label="Gini coefficient" :value="fmt(stats.gini, 3)" :note="stats.gini < 0.25 ? 'pasta communism' : stats.gini < 0.45 ? 'social-democratic pasta' : 'pasta oligarchy'" accent="var(--s4)" />
        <StatTile label="Shannon entropy" :value="`${fmt(stats.entropyBits, 2)} bit`" :note="`${fmt(stats.effectiveEaters, 1)} effective eaters`" accent="var(--s1)" />
        <StatTile label="bus factor" :value="busFactor" :note="`eaters needed for 50 % of all pasta`" accent="var(--s3)" />
      </div>

      <section class="card section">
        <h2>physics corner</h2>
        <PhysicsCorner :stats="stats" />
      </section>

      <section class="card section">
        <h2>attendance matrix</h2>
        <PastaHeatmap :entries="log!.entries" :dates="dates" :names="heatNames" />
      </section>

      <section class="card section">
        <h2>git log</h2>
        <CommitLog :entries="log!.entries" />
      </section>
    </template>
    <p v-else-if="loading" class="sub section">boiling water<span class="blink">_</span></p>

    <footer class="sub">femto-pasta · data: Hugging Face · {{ log?.updatedAt ? `last commit ${new Date(log.updatedAt).toLocaleString('en-GB')}` : '' }}</footer>
  </div>
</template>

<style scoped>
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 22px 0 18px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 14px; }
.logo { font-size: 38px; filter: drop-shadow(0 0 10px rgba(243,210,122,.3)); }
h1 { font-size: 26px; }
.accent { color: var(--pesto); }
nav { display: flex; gap: 6px; }
nav .btn { text-decoration: none; }
.section { margin-top: 16px; }
footer { margin-top: 32px; text-align: center; }
</style>
