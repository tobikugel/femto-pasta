<script setup lang="ts">
// The lab door: type the interlock key (the password), or come in through the QR code (/login?key=…)
const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const password = ref('')
const error = ref('')
const busy = ref(false)
const open = ref(false)
const input = ref<HTMLInputElement>()

const checks = ['Chiller at 18 °C', 'Pump laser warmed up', 'Oscillator mode-locked', 'Pasta water at 100 °C']
const done = ref(0)

async function login(pw: string) {
  if (!pw || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/login', { method: 'POST', body: { password: pw } })
    open.value = true
    await refreshSession()
    await new Promise(r => setTimeout(r, 450))   // let the shutter open
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : '/'
    await navigateTo(next, { replace: true })
  }
  catch (e: any) {
    error.value = e?.statusCode === 401 ? 'Interlock fault: wrong key. Hint: what goes on the pasta?' : (e?.statusMessage || 'Login failed')
    password.value = ''
    nextTick(() => input.value?.focus())
  }
  finally {
    busy.value = false
  }
}

onMounted(() => {
  const timer = setInterval(() => {
    if (++done.value >= checks.length) clearInterval(timer)
  }, 220)
  nextTick(() => input.value?.focus())
  const key = route.query.key
  if (typeof key === 'string' && key) login(key)
})
</script>

<template>
  <main class="door">
    <div class="panel" :class="{ open }">
      <div class="beam" aria-hidden="true" />

      <div class="sign">
        <svg viewBox="0 0 100 88" class="hazard" aria-hidden="true">
          <path d="M50 4 L96 84 H4 Z" fill="#f3c623" stroke="#111" stroke-width="5" stroke-linejoin="round" />
          <g stroke="#111" stroke-width="3.2" stroke-linecap="round">
            <line x1="50" y1="56" x2="50" y2="34" /><line x1="50" y1="56" x2="64" y2="44" /><line x1="50" y1="56" x2="36" y2="44" />
            <line x1="50" y1="56" x2="68" y2="58" /><line x1="50" y1="56" x2="32" y2="58" /><line x1="50" y1="56" x2="60" y2="70" />
            <line x1="50" y1="56" x2="40" y2="70" />
          </g>
          <circle cx="50" cy="56" r="6" fill="#111" />
          <line x1="56" y1="56" x2="90" y2="56" stroke="#111" stroke-width="4" />
        </svg>
        <div>
          <div class="warn">Laser radiation</div>
          <div class="cls">Class 4 pasta · authorised eaters only</div>
        </div>
      </div>

      <h1>femto<span>-pasta</span></h1>
      <p class="tag">Pasta Wednesday tracker of the femtosecond lab</p>

      <ul class="checks">
        <li v-for="(c, i) in checks" :key="c" :class="{ ok: i < done }"><span class="led" />{{ c }}</li>
      </ul>

      <form class="interlock" @submit.prevent="login(password)">
        <label for="pw">Interlock key</label>
        <div class="row">
          <input id="pw" ref="input" v-model="password" type="password" autocomplete="current-password" :disabled="busy || open" spellcheck="false" placeholder="••••••••••••">
          <button class="primary" :disabled="busy || open || !password">{{ open ? 'Shutter open' : busy ? 'Arming…' : 'Open shutter' }}</button>
        </div>
      </form>

      <div class="status" :class="{ open }">
        <span class="led big" />{{ open ? 'SHUTTER OPEN – enjoy your meal' : 'SHUTTER CLOSED' }}
      </div>
      <p v-if="error" class="err">{{ error }}</p>
      <p class="sub hint">No key? Scan the QR code in the kitchen. And never look into the pot with your remaining eye.</p>
    </div>
  </main>
</template>

<style scoped>
.door { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
.panel {
  position: relative; overflow: hidden;
  width: min(520px, 100%);
  background: linear-gradient(180deg, var(--surface-2), var(--surface));
  border: 1px solid var(--border); border-radius: 16px;
  padding: 28px 26px 22px;
  box-shadow: 0 30px 80px rgba(0,0,0,.55);
}
/* the beam across the top: dim while closed, bright when the shutter opens */
.beam { position: absolute; left: 0; right: 0; top: 0; height: 3px; background: var(--spectrum); opacity: .35; transition: opacity .3s, box-shadow .3s; }
.open .beam { opacity: 1; box-shadow: 0 0 18px 3px rgba(127,211,90,.6); }

.sign { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-radius: 10px; background: #f3c623; color: #111; }
.hazard { width: 54px; flex: 0 0 auto; }
.warn { font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: 16px; }
.cls { font-size: 12px; font-weight: 500; }

h1 { font-size: 34px; margin: 22px 0 2px; letter-spacing: -.02em; }
h1 span { color: var(--pesto); text-shadow: 0 0 18px rgba(127,211,90,.45); }
.tag { color: var(--text-2); margin: 0 0 16px; }

.checks { list-style: none; padding: 0; margin: 0 0 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12.5px; color: var(--muted); }
.checks li { display: flex; align-items: center; gap: 8px; transition: color .2s; }
.checks li.ok { color: var(--text-2); }
.led { width: 8px; height: 8px; border-radius: 50%; background: #3a2422; flex: 0 0 auto; transition: background .2s, box-shadow .2s; }
.checks li.ok .led { background: var(--pesto); box-shadow: 0 0 6px var(--pesto); }

.interlock label { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
.row { display: flex; gap: 8px; }
.row input { flex: 1; font-family: var(--mono); letter-spacing: .1em; padding: 10px 12px; }
.row button { white-space: nowrap; }

.status { display: flex; align-items: center; gap: 10px; margin-top: 16px; font-family: var(--mono); font-size: 12px; letter-spacing: .08em; color: var(--hene); }
.led.big { width: 11px; height: 11px; background: var(--hene); box-shadow: 0 0 8px var(--hene); }
.status.open { color: var(--pesto); }
.status.open .led.big { background: var(--pesto); box-shadow: 0 0 10px var(--pesto); }
.err { margin: 10px 0 0; }
.hint { margin: 14px 0 0; }
@media (max-width: 460px) { .checks { grid-template-columns: 1fr; } .row { flex-direction: column; } }
</style>
