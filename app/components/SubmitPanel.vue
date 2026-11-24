<script setup lang="ts">
// "I had pasta": pick the Wednesday, yourself and the number of servings. Re-submitting overwrites.
import { fmt, physics, sci } from '~/lib/stats'
import { shortDate } from '~/lib/scale'

const { log, submit } = usePasta()
const NEW = '\u0000new'
const maxServings = MAX_SERVINGS
const maxName = MAX_NAME_LENGTH
const LAST_NAME = 'femto-pasta:name'

const today = lastWednesday()
const dates = computed(() => Array.from({ length: 26 }, (_, i) => addDays(today, -7 * i)))
const date = ref(today)
const name = ref('')
const newName = ref('')
const servings = ref(1)
const busy = ref(false)
const msg = ref<{ ok: boolean, text: string } | null>(null)

const people = computed(() => [...(log.value?.people ?? [])].sort((a, b) => a.localeCompare(b)))
const who = computed(() => cleanName(name.value === NEW ? newName.value : name.value))
const existing = computed(() => log.value?.entries.find(e => e.date === date.value && e.name.toLowerCase() === who.value.toLowerCase()))

onMounted(() => {
  try {
    const n = localStorage.getItem(LAST_NAME)
    if (n) name.value = n
  }
  catch { /* storage blocked */ }
})
watch(people, (ps) => { if (name.value && name.value !== NEW && !ps.includes(name.value)) name.value = '' }, { once: true })
// show the stored count when switching to a day/person that already has one
watch(existing, (e) => { if (e) servings.value = e.servings })

const step = (d: number) => { servings.value = Math.min(MAX_SERVINGS, Math.max(0.5, servings.value + d)) }

async function send(n: number) {
  if (!who.value) { msg.value = { ok: false, text: 'Who are you? Pick your name first.' }; return }
  busy.value = true
  msg.value = null
  try {
    await submit(date.value, who.value, n)
    try { localStorage.setItem(LAST_NAME, canonicalName(log.value?.people ?? [], who.value)) }
    catch { /* storage blocked */ }
    if (name.value === NEW) { name.value = canonicalName(log.value?.people ?? [], who.value); newName.value = '' }
    msg.value = { ok: true, text: n ? `Pulse delivered: ${who.value} × ${fmt(n)} serving${n === 1 ? '' : 's'} ≈ ${sci(physics(n).photons, 1)} photons of 800 nm. Buon appetito!` : `Beam blocked: ${who.value} removed from ${date.value}` }
  }
  catch (e: any) {
    msg.value = { ok: false, text: `Misfire: ${e?.statusMessage || e?.message || 'submission failed'}` }
  }
  finally { busy.value = false }
}
</script>

<template>
  <section class="card submit">
    <h2>Fire a pulse – log your servings</h2>
    <form class="form" @submit.prevent="send(servings)">
      <div>
        <label for="date">pasta day</label>
        <select id="date" v-model="date">
          <option v-for="d in dates" :key="d" :value="d">{{ d === today ? `this Wednesday · ${shortDate(d, true)}` : `Wed ${shortDate(d, true)}` }}</option>
        </select>
      </div>
      <div>
        <label for="who">eater</label>
        <select id="who" v-model="name">
          <option value="" disabled>– who are you? –</option>
          <option v-for="p in people" :key="p" :value="p">{{ p }}</option>
          <option :value="NEW">+ new eater…</option>
        </select>
        <input v-if="name === NEW" v-model="newName" class="newname" placeholder="your name" :maxlength="maxName" autofocus>
      </div>
      <div>
        <label>servings</label>
        <div class="stepper">
          <button type="button" aria-label="less" :disabled="servings <= 0.5" @click="step(-0.5)">−</button>
          <span class="count num">{{ fmt(servings) }}</span>
          <button type="button" aria-label="more" :disabled="servings >= maxServings" @click="step(0.5)">+</button>
        </div>
      </div>
      <div class="plates" aria-hidden="true">
        <span v-for="i in Math.ceil(servings)" :key="i" :class="{ half: i > servings }">🍝</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="busy || !who">{{ busy ? 'Firing…' : existing ? 'Re-fire (overwrite)' : 'Fire 🍝' }}</button>
        <button v-if="existing" type="button" class="ghost" :disabled="busy" @click="send(0)">Block beam (delete)</button>
      </div>
    </form>
    <p v-if="existing && !msg" class="sub">{{ existing.name }} already logged {{ fmt(existing.servings) }} on {{ shortDate(existing.date) }} – firing again overwrites it.</p>
    <p v-if="msg" :class="msg.ok ? 'ok' : 'err'" class="msg">{{ msg.text }}</p>
  </section>
</template>

<style scoped>
.submit { border-color: var(--pesto-dim); box-shadow: 0 0 0 1px rgba(127,211,90,.08), 0 10px 40px rgba(127,211,90,.05); }
.form { display: flex; flex-wrap: wrap; gap: 14px 18px; align-items: flex-end; }
.form select { min-width: 190px; }
.newname { display: block; margin-top: 6px; width: 190px; }
.stepper { display: flex; align-items: center; gap: 6px; }
.stepper button { width: 36px; height: 36px; padding: 0; font-size: 18px; }
.count { min-width: 3ch; text-align: center; font-size: 22px; font-weight: 800; color: var(--parmesan); }
.plates { font-size: 22px; min-height: 36px; display: flex; flex-wrap: wrap; gap: 2px; max-width: 260px; align-items: center; }
.plates .half { opacity: .4; clip-path: inset(0 50% 0 0); }
.actions { display: flex; gap: 8px; margin-left: auto; }
.actions .primary { min-width: 110px; }
.msg { margin: 12px 0 0; word-break: break-word; }
@media (max-width: 600px) { .actions { margin-left: 0; } .form select, .newname { width: 100%; min-width: 0; } .form > div { flex: 1 1 100%; } }
</style>
