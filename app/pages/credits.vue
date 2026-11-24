<script setup lang="ts">
// The pasta fund: balances, payments, price per serving
import { computeCredits, euro } from '~/lib/credits'
import { fmt } from '~/lib/stats'
import { shortDate } from '~/lib/scale'

const { log, error, loading, load, pay, removePayment, changePrice } = usePasta()
onMounted(() => { if (!log.value) load() })

const today = isoDate(new Date())
const credits = computed(() => (log.value ? computeCredits(log.value, today) : null))
const people = computed(() => [...(log.value?.people ?? [])].sort((a, b) => a.localeCompare(b)))
const payments = computed(() => [...(log.value?.payments ?? [])].reverse())
const worst = computed(() => credits.value?.accounts.find(a => a.balance < 0) ?? null)
const maxNote = MAX_NOTE_LENGTH
const DEFAULT_PRICE_VALUE = DEFAULT_PRICE

// payment form
const form = reactive({ name: '', kind: 'in' as 'in' | 'out', amount: '' as string | number, date: today, note: '' })
const busy = ref(false)
const msg = ref<{ ok: boolean, text: string } | null>(null)
onMounted(() => {
  try { form.name = localStorage.getItem('femto-pasta:name') ?? '' }
  catch { /* storage blocked */ }
})
async function submitPayment() {
  const amount = Number(String(form.amount).replace(',', '.'))
  if (!form.name || !(amount > 0)) { msg.value = { ok: false, text: 'error: name and a positive amount, please' }; return }
  busy.value = true
  msg.value = null
  try {
    const signed = form.kind === 'in' ? amount : -amount
    await pay(form.date, form.name, signed, form.note)
    msg.value = { ok: true, text: `ledger += ${form.name} ${euro(signed, true)}` }
    form.amount = ''
    form.note = ''
  }
  catch (e: any) { msg.value = { ok: false, text: `error: ${e?.statusMessage || e?.message || 'failed'}` } }
  finally { busy.value = false }
}
async function remove(id: string, label: string) {
  if (!confirm(`Remove the payment "${label}"? (It stays in the Hugging Face history.)`)) return
  try { await removePayment(id) }
  catch (e: any) { alert(e?.statusMessage || 'failed') }
}

// price form
const priceForm = reactive({ price: '' as string | number, from: lastWednesday() })
const priceMsg = ref('')
async function submitPrice() {
  const p = Number(String(priceForm.price).replace(',', '.'))
  priceMsg.value = ''
  try {
    await changePrice(priceForm.from, p)
    priceMsg.value = `price := ${euro(p)} from ${priceForm.from}`
    priceForm.price = ''
  }
  catch (e: any) { priceMsg.value = `error: ${e?.statusMessage || 'failed'}` }
}

const status = (b: number) => (b < 0 ? '💸 owes' : b > 0 ? '✓ credit' : '= even')
const runway = (r: number | null) => (r === null ? '—' : r >= 52 ? '≥ 1 year' : `${Math.floor(r)} Wed`)
</script>

<template>
  <div class="wrap">
    <AppHeader />
    <p v-if="error" class="card err">error: {{ error }}</p>

    <template v-if="credits">
      <div class="grid tiles">
        <StatTile label="pasta fund" :value="euro(credits.fund)" :note="credits.fund < 0 ? 'the pot is in the red' : 'cash in the pot'" :accent="credits.fund < 0 ? 'var(--tomato)' : 'var(--pesto)'" />
        <StatTile label="outstanding debt" :value="euro(credits.debt)" :note="`${credits.debtors} debtor${credits.debtors === 1 ? '' : 's'} · 0 % interest`" accent="var(--s2)" />
        <StatTile label="prepaid credit" :value="euro(credits.credit)" note="owed back to the eaters, in pasta" accent="var(--s1)" />
        <StatTile label="price per serving" :value="euro(credits.price)" :note="`Σ paid ${euro(credits.totalPaid)} · Σ eaten ${euro(credits.totalSpent)}`" accent="var(--parmesan)" />
      </div>

      <section class="card section">
        <h2>balance sheet</h2>
        <BalanceBars :accounts="credits.accounts" />
        <p v-if="worst" class="sub debt">
          Pasta debt ceiling reached by <b>{{ worst.name }}</b>: {{ euro(worst.balance) }} ≈ {{ fmt(-worst.balance / credits.price, 1) }} unpaid servings
          ≈ {{ fmt(-worst.balance / credits.price * 125 / 1000, 2) }} kg of spaghetti.
        </p>
      </section>

      <div class="grid cols-2 section">
        <section class="card">
          <h2>git commit --amount</h2>
          <form class="form" @submit.prevent="submitPayment">
            <div>
              <label for="pname">member</label>
              <select id="pname" v-model="form.name">
                <option value="" disabled>— who? —</option>
                <option v-for="p in people" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div>
              <label for="kind">type</label>
              <select id="kind" v-model="form.kind">
                <option value="in">paid in (+ credit)</option>
                <option value="out">paid out (− credit)</option>
              </select>
            </div>
            <div>
              <label for="amount">amount (€)</label>
              <input id="amount" v-model="form.amount" inputmode="decimal" placeholder="20.00" class="amount">
            </div>
            <div>
              <label for="pdate">date</label>
              <input id="pdate" v-model="form.date" type="date" :max="today">
            </div>
            <div class="wide">
              <label for="note">note (optional)</label>
              <input id="note" v-model="form.note" :maxlength="maxNote" placeholder="cash to Robert, groceries Hofer, …">
            </div>
            <button class="primary" :disabled="busy">{{ busy ? 'pushing…' : 'commit' }}</button>
          </form>
          <p v-if="msg" :class="msg.ok ? 'ok' : 'err'" class="msg">{{ msg.text }}</p>
          <p class="sub">"Paid out" is money given back to someone, e.g. for buying the groceries out of their own pocket.</p>
        </section>

        <section class="card">
          <h2>price per serving</h2>
          <table class="data">
            <thead><tr><th>from</th><th class="r">€ / serving</th></tr></thead>
            <tbody>
              <tr v-if="!log!.prices.length"><td>the beginning</td><td class="r num">{{ euro(DEFAULT_PRICE_VALUE) }}</td></tr>
              <tr v-for="p in log!.prices" :key="p.from"><td>{{ p.from }}</td><td class="r num">{{ euro(p.price) }}</td></tr>
            </tbody>
          </table>
          <form class="form price" @submit.prevent="submitPrice">
            <div>
              <label for="newprice">new price (€)</label>
              <input id="newprice" v-model="priceForm.price" inputmode="decimal" placeholder="2.50" class="amount">
            </div>
            <div>
              <label for="from">from</label>
              <input id="from" v-model="priceForm.from" type="date">
            </div>
            <button :disabled="!priceForm.price">set</button>
          </form>
          <p v-if="priceMsg" class="msg" :class="priceMsg.startsWith('error') ? 'err' : 'ok'">{{ priceMsg }}</p>
          <p class="sub">Pasta eaten before that day keeps its old price.</p>
        </section>
      </div>

      <section class="card section">
        <h2>accounts</h2>
        <div class="scroll-x">
          <table class="data">
            <thead>
              <tr>
                <th>member</th><th class="r">servings</th><th class="r">eaten</th><th class="r">paid</th><th class="r">balance</th><th />
                <th class="r" title="pasta Wednesdays the credit lasts at the usual rate">runway</th><th class="r">last payment</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in credits.accounts" :key="a.name">
                <td class="name">{{ a.name }}</td>
                <td class="r num">{{ fmt(a.servings) }}</td>
                <td class="r num">{{ euro(a.spent) }}</td>
                <td class="r num">{{ euro(a.paid) }}</td>
                <td class="r num bal" :class="{ neg: a.balance < 0 }">{{ euro(a.balance, true) }}</td>
                <td class="status">{{ status(a.balance) }}</td>
                <td class="r num">{{ runway(a.runway) }}</td>
                <td class="r num sub">{{ a.lastPayment ? shortDate(a.lastPayment, true) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card section">
        <h2>ledger</h2>
        <p v-if="!payments.length" class="sub">No payments yet.</p>
        <div class="ledger">
          <div v-for="p in payments" :key="p.id" class="line">
            <span class="d">{{ p.date }}</span>
            <span class="who">{{ p.name }}</span>
            <span class="amt num" :class="{ neg: p.amount < 0 }">{{ euro(p.amount, true) }}</span>
            <span class="note">{{ p.note }}<template v-if="p.source === 'excel'"> (excel import)</template></span>
            <button class="ghost del" title="remove" @click="remove(p.id, `${p.name} ${euro(p.amount, true)}`)">✕</button>
          </div>
        </div>
      </section>
    </template>
    <p v-else-if="loading" class="sub">counting coins<span class="blink">_</span></p>
  </div>
</template>

<style scoped>
.section { margin-top: 16px; }
.debt { margin: 12px 0 0; }
.debt b { color: var(--text); }
.form { display: flex; flex-wrap: wrap; gap: 12px 14px; align-items: flex-end; }
.form select { min-width: 170px; }
.amount { width: 110px; }
.wide { flex: 1 1 100%; }
.wide input { width: 100%; }
.price { margin-top: 14px; }
.msg { margin: 10px 0 0; word-break: break-word; }
.name { font-weight: 600; white-space: nowrap; }
.bal { font-weight: 800; }
.neg, .amt.neg { color: var(--tomato); }
.status { white-space: nowrap; color: var(--text-2); }
td { white-space: nowrap; }
.ledger { font-size: 12.5px; }
.line { display: grid; grid-template-columns: 92px minmax(100px, 180px) 90px 1fr 32px; gap: 10px; align-items: center; padding: 2px 0; border-bottom: 1px solid var(--grid); }
.d { color: var(--muted); }
.who { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amt { text-align: right; color: var(--pesto); }
.note { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.del { padding: 2px 6px; font-size: 11px; opacity: .5; }
.del:hover { opacity: 1; border-color: var(--tomato); }
@media (max-width: 600px) { .line { grid-template-columns: 80px 1fr 80px 28px; } .note { display: none; } }
</style>
