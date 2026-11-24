<script setup lang="ts">
// The start page: log pasta in two taps (your name, then the number of servings).
// The statistics are on /dashboard.
import { fmt, physics, sci } from '~/lib/stats'
import { shortDate } from '~/lib/scale'

const { log, error, loading, load, submit } = usePasta()
onMounted(load)

const LAST_NAME = 'femto-pasta:name'
const today = lastWednesday()
/** "today" on a Wednesday, else "last Wednesday" */
const todayLabel = isoDate(new Date()) === today ? 'today' : 'last Wednesday'
const dates = Array.from({ length: 26 }, (_, i) => addDays(today, -7 * i))
const date = ref(today)
const pickDay = ref(false)

type Step = 'who' | 'count' | 'done'
const step = ref<Step>('who')
const name = ref('')
const adding = ref(false)
const newName = ref('')
const custom = ref(false)
const customCount = ref(4)
const busy = ref(false)
const msg = ref('')
const last = ref<{ name: string, servings: number, date: string } | null>(null)
const maxName = MAX_NAME_LENGTH
const maxServings = MAX_SERVINGS

// regulars first: most visits, then alphabetically
const people = computed(() => {
  const l = log.value
  if (!l) return []
  const visits = new Map<string, number>()
  for (const e of l.entries) visits.set(e.name, (visits.get(e.name) ?? 0) + 1)
  return [...l.people].sort((a, b) => (visits.get(b) ?? 0) - (visits.get(a) ?? 0) || a.localeCompare(b))
})
const existing = computed(() => log.value?.entries.find(e => e.date === date.value && e.name === name.value) ?? null)
const dayEntries = computed(() => log.value?.entries.filter(e => e.date === date.value) ?? [])
const dayTotal = computed(() => dayEntries.value.reduce((s, e) => s + e.servings, 0))

onMounted(() => {
  try {
    const n = localStorage.getItem(LAST_NAME)
    if (n) { name.value = n; step.value = 'count' }
  }
  catch { /* storage blocked */ }
})
// a remembered name that is no longer in the list: ask again
watch(log, (l) => { if (l && name.value && !l.people.includes(name.value) && step.value === 'count') step.value = 'who' }, { once: true })

function choose(n: string) {
  name.value = n
  msg.value = ''
  custom.value = false
  step.value = 'count'
}
function addNew() {
  const n = cleanName(newName.value)
  if (!n) return
  choose(canonicalName(log.value?.people ?? [], n))
  adding.value = false
  newName.value = ''
}
function notMe() {
  try { localStorage.removeItem(LAST_NAME) }
  catch { /* storage blocked */ }
  step.value = 'who'
}

async function fire(servings: number) {
  if (busy.value || !name.value) return
  busy.value = true
  msg.value = ''
  try {
    await submit(date.value, name.value, servings)
    // the server may have matched the name to an existing spelling
    name.value = canonicalName(log.value?.people ?? [], name.value)
    try { localStorage.setItem(LAST_NAME, name.value) }
    catch { /* storage blocked */ }
    last.value = { name: name.value, servings, date: date.value }
    step.value = 'done'
  }
  catch (e: any) {
    msg.value = `Misfire: ${e?.statusMessage || e?.message || 'could not save'}. Try again.`
  }
  finally { busy.value = false }
}

const plates = (n: number) => '🍝'.repeat(Math.min(n, 3))
</script>

<template>
  <div class="wrap">
    <AppHeader />
    <p v-if="error" class="card err">Beam lost: {{ error }}</p>

    <main class="quick">
      <!-- the day -->
      <div class="day">
        <span class="sub">Pasta day</span>
        <button v-if="!pickDay" class="link" @click="pickDay = true">
          {{ date === today ? todayLabel : 'Wednesday' }}, {{ shortDate(date, true) }} <span class="sub">(change)</span>
        </button>
        <select v-else v-model="date" class="daysel" @change="pickDay = false">
          <option v-for="d in dates" :key="d" :value="d">{{ d === today ? (todayLabel === 'today' ? 'Today' : 'Last Wednesday') : 'Wednesday' }}, {{ shortDate(d, true) }}</option>
        </select>
      </div>

      <!-- step 1: who -->
      <section v-if="step === 'who'" class="card step">
        <h2>Who are you?</h2>
        <p v-if="loading && !log" class="sub">loading names…</p>
        <div class="names">
          <button v-for="p in people" :key="p" class="name" @click="choose(p)">{{ p }}</button>
          <button v-if="!adding" class="name new" @click="adding = true">+ New eater</button>
        </div>
        <form v-if="adding" class="addnew" @submit.prevent="addNew">
          <input v-model="newName" placeholder="Your name" :maxlength="maxName" autofocus>
          <button class="primary" :disabled="!newName.trim()">OK</button>
          <button type="button" class="ghost" @click="adding = false">Cancel</button>
        </form>
      </section>

      <!-- step 2: how many -->
      <section v-else-if="step === 'count'" class="card step">
        <h2>Hi {{ name.split(' ')[0] }}, how many servings?</h2>
        <p v-if="existing" class="already">
          You already logged <b>{{ fmt(existing.servings) }}</b> for this day. Tap a number to change it,
          or <button class="link danger" :disabled="busy" @click="fire(0)">remove it</button>.
        </p>
        <div class="counts">
          <button v-for="n in [1, 2, 3]" :key="n" class="count" :class="{ current: existing?.servings === n }" :disabled="busy" @click="fire(n)">
            <span class="n">{{ n }}</span>
            <span class="plates" aria-hidden="true">{{ plates(n) }}</span>
          </button>
        </div>
        <div class="extra">
          <button class="ghost" :disabled="busy" @click="fire(0.5)">½ serving</button>
          <button v-if="!custom" class="ghost" :disabled="busy" @click="custom = true">More…</button>
          <span v-else class="stepper">
            <button type="button" :disabled="customCount <= 1" @click="customCount--">−</button>
            <span class="num big">{{ customCount }}</span>
            <button type="button" :disabled="customCount >= maxServings" @click="customCount++">+</button>
            <button class="primary" :disabled="busy" @click="fire(customCount)">Log {{ customCount }}</button>
          </span>
        </div>
        <p v-if="busy" class="sub">firing…</p>
        <p v-if="msg" class="err">{{ msg }}</p>
        <button class="link notme" @click="notMe">Not {{ name }}?</button>
      </section>

      <!-- step 3: done -->
      <section v-else class="card step done">
        <div class="check" aria-hidden="true">✓</div>
        <template v-if="last && last.servings > 0">
          <h2 class="donetitle">Logged!</h2>
          <p class="big-line"><b>{{ last.name }}</b>: {{ fmt(last.servings) }} serving{{ last.servings === 1 ? '' : 's' }} on {{ shortDate(last.date) }}</p>
          <p class="sub">That's about {{ sci(physics(last.servings).photons, 1) }} photons at 800 nm. Buon appetito!</p>
        </template>
        <template v-else-if="last">
          <h2 class="donetitle">Removed</h2>
          <p class="big-line">{{ last.name }} has no pasta logged on {{ shortDate(last.date) }}.</p>
        </template>
        <div class="doneactions">
          <button @click="step = 'count'">Change</button>
          <button @click="step = 'who'">Log someone else</button>
          <NuxtLink to="/dashboard" class="btn primary">Open dashboard →</NuxtLink>
        </div>
      </section>

      <!-- who has eaten on this day -->
      <p v-if="dayEntries.length" class="sub today">
        {{ shortDate(date) }} so far: {{ fmt(dayTotal) }} serving{{ dayTotal === 1 ? '' : 's' }} by {{ dayEntries.length }}
        {{ dayEntries.length === 1 ? 'eater' : 'eaters' }} – {{ dayEntries.map(e => `${e.name.split(' ')[0]} ${fmt(e.servings)}`).join(', ') }}
      </p>
      <p class="todash"><NuxtLink to="/dashboard" class="btn ghost">See all statistics on the dashboard →</NuxtLink></p>
    </main>
  </div>
</template>

<style scoped>
.quick { max-width: 640px; margin: 0 auto; }
.day { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.link { background: none; border: none; padding: 0; color: var(--pesto); font: inherit; font-weight: 500; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.link.danger { color: var(--hene); }
.daysel { min-width: 240px; }
.step { padding: 22px; border-color: var(--pesto-dim); box-shadow: 0 0 0 1px rgba(127,211,90,.06), 0 12px 40px rgba(127,211,90,.05); }
.step h2 { font-size: 15px; margin-bottom: 18px; }

.names { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.name { padding: 16px 12px; font-size: 16px; font-weight: 500; text-align: left; border-radius: 10px; }
.name:hover { border-color: var(--pesto); background: #1f2a25; }
.name.new { color: var(--pesto); border-style: dashed; }
.addnew { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.addnew input { flex: 1; min-width: 160px; font-size: 16px; padding: 12px; }

.already { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin: 0 0 14px; }
.counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.count { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 22px 8px; border-radius: 14px; border-width: 2px; }
.count:hover { border-color: var(--pesto); background: #1f2a25; box-shadow: 0 0 18px rgba(127,211,90,.18); }
.count.current { border-color: var(--parmesan); }
.count .n { font-size: 40px; font-weight: 700; line-height: 1; color: var(--parmesan); }
.count .plates { font-size: 20px; min-height: 26px; }
.extra { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
.stepper { display: inline-flex; align-items: center; gap: 6px; }
.stepper > button:not(.primary) { width: 40px; height: 40px; padding: 0; font-size: 18px; }
.big { font-size: 22px; font-weight: 700; min-width: 2ch; text-align: center; color: var(--parmesan); }
.notme { margin-top: 16px; font-size: 13px; color: var(--muted); }

.done { text-align: center; }
.check { width: 64px; height: 64px; margin: 4px auto 10px; border-radius: 50%; display: grid; place-items: center; font-size: 34px; font-weight: 700; color: #0b1408; background: var(--pesto); box-shadow: 0 0 30px rgba(127,211,90,.55); }
.donetitle { justify-content: center; margin-bottom: 6px !important; }
.donetitle::before { display: none; }
.big-line { font-size: 18px; margin: 4px 0; }
.doneactions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 18px; }
.doneactions .btn { text-decoration: none; }

.today { margin: 14px 2px 0; }
.todash { text-align: center; margin-top: 26px; }
.todash .btn { text-decoration: none; }
@media (max-width: 480px) {
  .names { grid-template-columns: 1fr 1fr; }
  .count { padding: 18px 4px; }
}
</style>
