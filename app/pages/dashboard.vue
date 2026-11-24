<script setup lang="ts">
import { computeStats, fmt } from '~/lib/stats'
import { shortDate } from '~/lib/scale'

const { log, error, loading, load } = usePasta()
onMounted(load)   // always fresh numbers when the dashboard is opened

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
</script>

<template>
  <div class="wrap">
    <AppHeader />

    <p v-if="error" class="card err">Beam lost: {{ error }}</p>

    <template v-if="stats">
      <div class="grid tiles section">
        <StatTile label="total servings" :value="fmt(stats.total)" :note="`${stats.entries} plates logged`" />
        <StatTile label="pasta days" :value="stats.days.length" :note="stats.days.length ? `since ${shortDate(stats.days[0]!.date, true)}` : '—'" accent="var(--s1)" />
        <StatTile label="per Wednesday" :value="fmt(stats.meanPerDay, 1)" :note="`${fmt(stats.meanEatersPerDay, 1)} eaters on average`" accent="var(--s3)" />
        <StatTile label="servings per visit" :value="`${fmt(stats.meanPerEntry)} ± ${fmt(stats.stdPerEntry)}`" :note="`mean ± standard deviation · median ${fmt(stats.medianPerEntry)}`" accent="var(--parmesan)" />
        <StatTile label="record day" :value="stats.recordDay ? fmt(stats.recordDay.servings) : '—'" :note="stats.recordDay ? shortDate(stats.recordDay.date, true) : ''" accent="var(--s2)" />
        <StatTile label="repetition rate" :value="`${fmt(stats.trendPerWeek, 1)}/wk`" :note="stats.nextMilestone?.date ? `${stats.nextMilestone.value} servings ≈ ${shortDate(stats.nextMilestone.date, true)} (R² = ${fmt(stats.trendR2)})` : 'need more data'" accent="var(--s5)" />
      </div>

      <section class="card section">
        <h2>Pulse train – servings per Wednesday</h2>
        <WeeklyBars :days="stats.days" :mean="stats.meanPerDay" />
      </section>

      <div class="grid cols-2 section">
        <section class="card">
          <h2>Accumulated fluence – the top five</h2>
          <CumulativeLines :entries="log!.entries" :dates="dates" :names="top5" />
        </section>
        <section class="card">
          <h2>Beam profile – servings per visit</h2>
          <ServingsHistogram :histogram="stats.histogram" :mean="stats.meanPerEntry" :std="stats.stdPerEntry" />
        </section>
      </div>

      <section class="card section">
        <h2>Power ranking</h2>
        <Leaderboard :people="stats.people" />
      </section>

      <section class="card section">
        <h2>Hall of fame</h2>
        <BadgeWall :badges="stats.badges" />
      </section>

      <div class="grid cols-3 section">
        <StatTile label="Gini coefficient" :value="fmt(stats.gini, 3)" :note="stats.gini < 0.25 ? 'flat-top beam: pasta shared evenly' : stats.gini < 0.45 ? 'Gaussian-ish distribution' : 'hot spot: a few eat it all'" accent="var(--s4)" />
        <StatTile label="Shannon entropy" :value="`${fmt(stats.entropyBits, 2)} bit`" :note="`${fmt(stats.effectiveEaters, 1)} effective eaters`" accent="var(--s1)" />
        <StatTile label="50 % encircled energy" :value="`${busFactor} eaters`" note="the fewest eaters who ate half of all pasta" accent="var(--s3)" />
      </div>

      <section class="card section">
        <h2>Laser physics corner</h2>
        <PhysicsCorner :stats="stats" />
      </section>

      <section class="card section">
        <h2>Shot map – who ate when</h2>
        <PastaHeatmap :entries="log!.entries" :dates="dates" :names="heatNames" />
      </section>

      <section class="card section">
        <h2>Shot log</h2>
        <ShotLog :entries="log!.entries" />
      </section>
    </template>
    <p v-else-if="loading" class="sub section">pumping the gain medium<span class="blink">…</span></p>

    <footer class="sub">femto-pasta · λ = 800 nm, τ = 30 fs, servings = ∞ · {{ log?.updatedAt ? `last shot ${new Date(log.updatedAt).toLocaleString('en-GB')}` : '' }}</footer>
  </div>
</template>

<style scoped>
.section { margin-top: 16px; }
footer { margin-top: 32px; text-align: center; }
</style>
