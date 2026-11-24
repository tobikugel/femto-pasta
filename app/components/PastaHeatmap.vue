<script setup lang="ts">
// Who ate how much on which Wednesday: people × pasta days
import type { PastaEntry } from '#shared/types/pasta'
import { fmt } from '~/lib/stats'
import { shortDate } from '~/lib/scale'

const props = defineProps<{ entries: PastaEntry[], dates: string[], names: string[] }>()
const hover = ref<{ name: string, date: string, v: number, x: number, y: number } | null>(null)
const box = ref<HTMLElement>()

const cells = computed(() => {
  const m = new Map(props.entries.map(e => [`${e.name}\u0000${e.date}`, e.servings]))
  return props.names.map(name => ({ name, row: props.dates.map(date => ({ date, v: m.get(`${name}\u0000${date}`) ?? 0 })) }))
})
const max = computed(() => Math.max(1, ...props.entries.map(e => e.servings)))
// one hue (pesto green), dark → bright with the servings
function color(v: number) {
  if (!v) return 'var(--surface-2)'
  const t = Math.min(1, v / max.value)
  return `color-mix(in oklab, #2b4a22 ${Math.round((1 - t) * 100)}%, #b6f08f)`
}
function enter(ev: MouseEvent, name: string, date: string, v: number) {
  const r = (ev.target as HTMLElement).getBoundingClientRect()
  const b = box.value!.getBoundingClientRect()
  hover.value = { name, date, v, x: r.left - b.left + r.width / 2, y: r.top - b.top }
}
</script>

<template>
  <div ref="box" class="hm">
    <div class="scroll-x">
      <table>
        <tbody>
          <tr v-for="r in cells" :key="r.name">
            <th>{{ r.name }}</th>
            <td v-for="c in r.row" :key="c.date">
              <span class="cell" :style="{ background: color(c.v) }" @mouseenter="enter($event, r.name, c.date, c.v)" @mouseleave="hover = null" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="hover" class="tip" :style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
      <b>{{ hover.name }}</b> · {{ shortDate(hover.date, true) }}<span class="sub">{{ hover.v ? `${fmt(hover.v)} servings` : 'no shot fired' }}</span>
    </div>
    <p class="sub scale">0 <span class="cell" style="background: var(--surface-2)" /><span class="ramp" /> {{ fmt(max) }} servings · one column per pasta day</p>
  </div>
</template>

<style scoped>
.hm { position: relative; }
table { border-collapse: separate; border-spacing: 2px; }
th { text-align: right; font-weight: 400; color: var(--text-2); font-size: 12px; padding-right: 8px; white-space: nowrap; position: sticky; left: 0; background: var(--surface); z-index: 1; }
td { padding: 0; }
.cell { display: block; width: 14px; height: 14px; border-radius: 3px; }
.cell:hover { outline: 1px solid var(--text); }
.scale { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; }
.scale .cell { display: inline-block; }
.ramp { display: inline-block; width: 80px; height: 10px; border-radius: 3px; background: linear-gradient(90deg, #2b4a22, #b6f08f); }
</style>
