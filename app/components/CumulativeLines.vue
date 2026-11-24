<script setup lang="ts">
// Cumulative servings of the top five eaters over time (the "pasta race")
import type { PastaEntry } from '#shared/types/pasta'
import { fmt } from '~/lib/stats'
import { linear, SERIES, shortDate, ticks } from '~/lib/scale'

const props = defineProps<{ entries: PastaEntry[], dates: string[], names: string[] }>()
const box = ref<HTMLElement>()
const width = useWidth(box)
const H = 240
const M = { t: 12, r: 90, b: 26, l: 40 }
const hover = ref<number | null>(null)

const g = computed(() => {
  const dates = props.dates
  const series = props.names.map((name, k) => {
    let c = 0
    const per = new Map(props.entries.filter(e => e.name === name).map(e => [e.date, e.servings]))
    return { name, color: SERIES[k]!, values: dates.map(d => (c += per.get(d) ?? 0)) }
  })
  const max = Math.max(1, ...series.map(s => s.values[s.values.length - 1] ?? 0))
  const yt = ticks(max)
  const y = linear(0, yt[yt.length - 1]!, H - M.b, M.t)
  const x = linear(0, Math.max(1, dates.length - 1), M.l, width.value - M.r)
  const lines = series.map(s => ({ ...s, d: s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') }))
  // end labels, pushed apart so they don't overlap
  const ends = lines.map(l => ({ name: l.name, color: l.color, v: l.values[l.values.length - 1] ?? 0, y: y(l.values[l.values.length - 1] ?? 0) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 13) ends[i]!.y = ends[i - 1]!.y + 13
  const n = dates.length
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((width.value - M.l - M.r) / 70))))
  const labels = dates.map((d, i) => ({ i, d })).filter(({ i }) => i % every === 0 || i === n - 1)
  if (labels.length > 1 && x(labels[labels.length - 1]!.i) - x(labels[labels.length - 2]!.i) < 56) labels.splice(labels.length - 2, 1)
  return { lines, ends, x, y, yt, labels }
})

function move(ev: MouseEvent) {
  const n = props.dates.length
  if (!n) return
  const rect = (ev.currentTarget as SVGElement).getBoundingClientRect()
  const px = ev.clientX - rect.left
  const i = Math.round(((px - M.l) / (width.value - M.l - M.r)) * (n - 1))
  hover.value = Math.min(n - 1, Math.max(0, i))
}
const tip = computed(() => {
  if (hover.value === null) return null
  const i = hover.value
  return { x: g.value.x(i), date: props.dates[i]!, rows: g.value.lines.map(l => ({ name: l.name, color: l.color, v: l.values[i]! })).sort((a, b) => b.v - a.v) }
})
</script>

<template>
  <div ref="box" class="chart">
    <div class="legend">
      <span v-for="l in g.lines" :key="l.name"><i :style="{ background: l.color }" />{{ l.name }}</span>
    </div>
    <svg :width="width" :height="H" role="img" aria-label="Cumulative servings of the top eaters" @mousemove="move" @mouseleave="hover = null">
      <template v-for="t in g.yt" :key="t">
        <line :x1="M.l" :x2="width - M.r" :y1="g.y(t)" :y2="g.y(t)" class="gridline" />
        <text :x="M.l - 6" :y="g.y(t)" class="axis" text-anchor="end" dominant-baseline="middle">{{ t }}</text>
      </template>
      <text v-for="l in g.labels" :key="l.i" :x="g.x(l.i)" :y="H - 8" text-anchor="middle" class="axis">{{ shortDate(l.d) }}</text>
      <line v-if="tip" :x1="tip.x" :x2="tip.x" :y1="M.t" :y2="H - M.b" class="cross" />
      <path v-for="l in g.lines" :key="l.name" :d="l.d" :stroke="l.color" class="line" />
      <template v-if="tip">
        <circle v-for="l in g.lines" :key="`c${l.name}`" :cx="tip.x" :cy="g.y(l.values[hover!]!)" r="4" :fill="l.color" class="dot" />
      </template>
      <g v-for="e in g.ends" :key="`e${e.name}`">
        <text :x="width - M.r + 8" :y="e.y" dominant-baseline="middle" class="end">{{ e.name.length > 10 ? `${e.name.slice(0, 9)}…` : e.name }} <tspan class="axis">{{ fmt(e.v) }}</tspan></text>
      </g>
    </svg>
    <div v-if="tip" class="tip" :style="{ left: `${Math.min(tip.x, width - 90)}px`, top: '40px' }">
      <b>{{ shortDate(tip.date, true) }}</b>
      <span v-for="r in tip.rows" :key="r.name" class="row"><i :style="{ background: r.color }" />{{ r.name }} <b>{{ fmt(r.v) }}</b></span>
    </div>
  </div>
</template>

<style scoped>
.chart { position: relative; }
svg { display: block; overflow: visible; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--text-2); margin-bottom: 8px; }
.legend i, .row i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.gridline { stroke: var(--grid); }
.axis { fill: var(--muted); font-size: 11px; font-family: var(--mono); }
.end { fill: var(--text-2); font-size: 11px; font-family: var(--mono); }
.line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.cross { stroke: var(--muted); stroke-dasharray: 2 3; }
.dot { stroke: var(--surface); stroke-width: 2; }
.row { display: block; }
</style>
