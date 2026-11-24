<script setup lang="ts">
// Servings per pasta Wednesday, with the mean as a dashed line
import type { DayStats } from '~/lib/stats'
import { fmt } from '~/lib/stats'
import { barPath, linear, shortDate, ticks } from '~/lib/scale'

const props = defineProps<{ days: DayStats[], mean: number }>()
const box = ref<HTMLElement>()
const width = useWidth(box)
const H = 220
const M = { t: 12, r: 12, b: 26, l: 34 }
const hover = ref<number | null>(null)

const g = computed(() => {
  const n = props.days.length
  const max = Math.max(1, ...props.days.map(d => d.servings))
  const yt = ticks(max)
  const y = linear(0, yt[yt.length - 1]!, H - M.b, M.t)
  const step = (width.value - M.l - M.r) / Math.max(1, n)
  const gap = Math.min(2, step * 0.3)
  const bars = props.days.map((d, i) => ({ d, x: M.l + i * step + gap / 2, w: step - gap, y: y(d.servings) }))
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((width.value - M.l) / 64))))
  const labels = bars.filter((_, i) => i % every === 0 || i === n - 1).map(b => ({ x: b.x + b.w / 2, t: shortDate(b.d.date) }))
  return { bars, yt, y, step, labels }
})
const tip = computed(() => (hover.value === null ? null : g.value.bars[hover.value]))
</script>

<template>
  <div ref="box" class="chart">
    <svg :width="width" :height="H" role="img" aria-label="Servings per pasta day">
      <g>
        <template v-for="t in g.yt" :key="t">
          <line :x1="M.l" :x2="width - M.r" :y1="g.y(t)" :y2="g.y(t)" class="gridline" />
          <text :x="M.l - 6" :y="g.y(t)" class="axis" text-anchor="end" dominant-baseline="middle">{{ t }}</text>
        </template>
      </g>
      <path v-for="(b, i) in g.bars" :key="b.d.date" :d="barPath(b.x, b.w, b.y, H - M.b)" class="bar" :class="{ dim: hover !== null && hover !== i }" />
      <line v-if="days.length" :x1="M.l" :x2="width - M.r" :y1="g.y(mean)" :y2="g.y(mean)" class="mean" />
      <text v-if="days.length" :x="width - M.r" :y="g.y(mean) - 5" text-anchor="end" class="axis meanlabel">μ = {{ fmt(mean, 1) }}</text>
      <text v-for="l in g.labels" :key="l.x" :x="l.x" :y="H - 8" text-anchor="middle" class="axis">{{ l.t }}</text>
      <rect v-for="(b, i) in g.bars" :key="`h${i}`" :x="M.l + i * g.step" :y="M.t" :width="g.step" :height="H - M.t - M.b" fill="transparent" @mouseenter="hover = i" @mouseleave="hover = null" />
    </svg>
    <div v-if="tip" class="tip" :style="{ left: `${tip.x + tip.w / 2}px`, top: `${tip.y}px` }">
      <b>{{ shortDate(tip.d.date, true) }}</b> · {{ fmt(tip.d.servings) }} servings
      <span class="sub">{{ tip.d.eaters }} eaters · top: {{ tip.d.top }}</span>
    </div>
    <p v-if="!days.length" class="sub">No pasta yet. The pot is cold.</p>
  </div>
</template>

<style scoped>
.chart { position: relative; }
svg { display: block; overflow: visible; }
.gridline { stroke: var(--grid); stroke-width: 1; }
.axis { fill: var(--muted); font-size: 11px; font-family: var(--mono); }
.bar { fill: var(--pesto); transition: opacity .15s; }
.bar.dim { opacity: .45; }
.mean { stroke: var(--parmesan); stroke-width: 1.5; stroke-dasharray: 4 4; }
.meanlabel { fill: var(--parmesan); }
</style>
