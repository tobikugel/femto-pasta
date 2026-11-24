<script setup lang="ts">
// The group's pasta in units a femto lab understands
import { duration, fmt, PHYSICS, sci, si, type Stats } from '~/lib/stats'

const props = defineProps<{ stats: Stats }>()
const rows = computed(() => {
  const p = props.stats.physics
  return [
    { k: 'mass (dry)', v: p.grams >= 1e6 ? `${Number((p.grams / 1e6).toPrecision(3))} t` : p.grams >= 1000 ? `${Number((p.grams / 1000).toPrecision(3))} kg` : `${fmt(p.grams)} g`, n: `${PHYSICS.grams} g per serving` },
    { k: 'energy', v: si(p.joules, 'J'), n: `${sci(p.kcal)} kcal (with pesto)` },
    { k: '800 nm photons', v: sci(p.photons), n: 'same energy, as Ti:Sa light' },
    { k: 'Ti:Sa runtime', v: duration(p.laserSeconds), n: `${sci(p.laserPulses)} pulses of 1 mJ at 1 kHz` },
    { k: 'spaghetti length', v: si(p.metres, 'm'), n: `light needs ${si(p.lightSeconds, 's')} for that` },
    { k: 'glucose units', v: sci(p.glucoseUnits), n: `${fmt(p.glucoseMol, 1)} mol of starch monomers` },
    { k: 'human idle time', v: duration(p.humanSeconds), n: `one physicist at ${PHYSICS.humanPower} W` },
    { k: 'E = mc²', v: si(p.restEnergy, 'J'), n: `≈ ${sci(p.restEnergy / 4.184e15)} Mt TNT, if fully annihilated` },
  ]
})
</script>

<template>
  <div class="phys">
    <div v-for="r in rows" :key="r.k" class="row">
      <div class="k">{{ r.k }}</div>
      <div class="v num">{{ r.v }}</div>
      <div class="sub">{{ r.n }}</div>
    </div>
  </div>
</template>

<style scoped>
.phys { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.row { padding: 10px 12px; border-left: 2px solid var(--s1); background: var(--surface-2); border-radius: 0 6px 6px 0; }
.k { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.v { font-size: 18px; font-weight: 800; color: var(--text); }
</style>
