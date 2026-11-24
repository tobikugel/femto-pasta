<script setup lang="ts">
// How many servings one eater has per visit, with a fitted normal distribution N(μ, σ²) on top
import { fmt } from '~/lib/stats'
import { barPath, linear, ticks } from '~/lib/scale'

const props = defineProps<{ histogram: { servings: number, count: number }[], mean: number, std: number }>()
const box = ref<HTMLElement>()
const width = useWidth(box)
const H = 200
const M = { t: 14, r: 12, b: 28, l: 34 }
const hover = ref<number | null>(null)

const g = computed(() => {
  const h = props.histogram
  const lo = Math.min(0.5, ...h.map(b => b.servings))
  const hi = Math.max(3, ...h.map(b => b.servings))
  // bins of ½ serving
  const bins: { s: number, count: number }[] = []
  for (let s = Math.floor(lo * 2) / 2; s <= hi + 1e-9; s += 0.5) bins.push({ s, count: h.filter(b => b.servings >= s - 0.125 && b.servings < s + 0.375).reduce((a, b) => a + b.count, 0) })
  const total = bins.reduce((a, b) => a + b.count, 0)
  const max = Math.max(1, ...bins.map(b => b.count))
  const yt = ticks(max)
  const y = linear(0, yt[yt.length - 1]!, H - M.b, M.t)
  const x = linear(bins[0]!.s - 0.25, bins[bins.length - 1]!.s + 0.25, M.l, width.value - M.r)
  const bw = x(0.5) - x(0)
  const bars = bins.map(b => ({ ...b, x: x(b.s - 0.25) + 1, w: bw - 2, y: y(b.count) }))
  // the Gaussian, scaled to counts per ½-serving bin
  let curve = ''
  if (props.std > 0 && total) {
    const pts: string[] = []
    for (let i = 0; i <= 80; i++) {
      const s = bins[0]!.s - 0.25 + (i / 80) * (bins.length * 0.5)
      const pdf = Math.exp(-((s - props.mean) ** 2) / (2 * props.std ** 2)) / (props.std * Math.sqrt(2 * Math.PI))
      pts.push(`${i ? 'L' : 'M'}${x(s).toFixed(1)},${y(Math.min(pdf * total * 0.5, yt[yt.length - 1]!)).toFixed(1)}`)
    }
    curve = pts.join('')
  }
  return { bars, y, x, yt, curve }
})
const tip = computed(() => (hover.value === null ? null : g.value.bars[hover.value]))
</script>

<template>
  <div ref="box" class="chart">
    <svg :width="width" :height="H" role="img" aria-label="Distribution of servings per visit">
      <template v-for="t in g.yt" :key="t">
        <line :x1="M.l" :x2="width - M.r" :y1="g.y(t)" :y2="g.y(t)" class="gridline" />
        <text :x="M.l - 6" :y="g.y(t)" class="axis" text-anchor="end" dominant-baseline="middle">{{ t }}</text>
      </template>
      <path v-for="(b, i) in g.bars" :key="b.s" :d="barPath(b.x, b.w, b.y, H - M.b)" class="bar" :class="{ dim: hover !== null && hover !== i }" />
      <path v-if="g.curve" :d="g.curve" class="gauss" />
      <line v-if="std > 0" :x1="g.x(mean)" :x2="g.x(mean)" :y1="M.t" :y2="H - M.b" class="mu" />
      <text v-for="b in g.bars.filter(b => Number.isInteger(b.s))" :key="`l${b.s}`" :x="b.x + b.w / 2" :y="H - 9" text-anchor="middle" class="axis">{{ b.s }}</text>
      <rect v-for="(b, i) in g.bars" :key="`h${i}`" :x="b.x - 1" :y="M.t" :width="b.w + 2" :height="H - M.t - M.b" fill="transparent" @mouseenter="hover = i" @mouseleave="hover = null" />
    </svg>
    <div v-if="tip" class="tip" :style="{ left: `${tip.x + tip.w / 2}px`, top: `${tip.y}px` }"><b>{{ fmt(tip.s) }}</b> servings: {{ tip.count }}×</div>
    <p class="sub legend"><span class="sw bar-sw" /> visits <span class="sw gauss-sw" /> N(μ = {{ fmt(mean) }}, σ = {{ fmt(std) }})</p>
  </div>
</template>

<style scoped>
.chart { position: relative; }
svg { display: block; overflow: visible; }
.gridline { stroke: var(--grid); }
.axis { fill: var(--muted); font-size: 11px; font-family: var(--mono); }
.bar { fill: var(--s1); transition: opacity .15s; }
.bar.dim { opacity: .45; }
.gauss { fill: none; stroke: var(--parmesan); stroke-width: 2; }
.mu { stroke: var(--parmesan); stroke-dasharray: 3 3; opacity: .7; }
.legend { margin: 6px 0 0; }
.sw { display: inline-block; width: 14px; height: 10px; border-radius: 3px; vertical-align: -1px; margin: 0 4px 0 10px; }
.sw:first-child { margin-left: 0; }
.bar-sw { background: var(--s1); }
.gauss-sw { height: 2px; background: var(--parmesan); vertical-align: 3px; }
</style>
