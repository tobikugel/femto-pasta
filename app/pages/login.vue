<script setup lang="ts">
// The door: type the password, or come in through the QR code (/login?key=…)
const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const password = ref('')
const error = ref('')
const busy = ref(false)
const input = ref<HTMLInputElement>()

const boot = [
  '[ 0.000000] femto-pasta kernel 6.6.6-al-dente booting…',
  '[ 0.004200] detected 1 × pot, 1 × colander, ∞ × hunger',
  '[ 0.013370] mounting /dev/pesto … ok',
  '[ 0.031415] Ti:Sa oscillator idle, lab members drifting towards kitchen',
]
const shown = ref(0)

async function login(pw: string) {
  if (!pw || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/login', { method: 'POST', body: { password: pw } })
    await refreshSession()
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : '/'
    await navigateTo(next, { replace: true })
  }
  catch (e: any) {
    error.value = e?.statusCode === 401 ? 'sudo: 1 incorrect password attempt. Hint: what goes on pasta?' : (e?.statusMessage || 'Login failed')
    password.value = ''
    nextTick(() => input.value?.focus())
  }
  finally {
    busy.value = false
  }
}

onMounted(() => {
  const timer = setInterval(() => {
    shown.value++
    if (shown.value >= boot.length) {
      clearInterval(timer)
      nextTick(() => input.value?.focus())
    }
  }, 180)
  const key = route.query.key
  if (typeof key === 'string' && key) login(key)
})
</script>

<template>
  <main class="door">
    <div class="term">
      <div class="bar">
        <span class="dot" style="background:#ff6b5a" /><span class="dot" style="background:#f3d27a" /><span class="dot" style="background:#7fd35a" />
        <span class="title">pasta@femto: ~</span>
      </div>
      <div class="body">
        <pre class="logo" aria-label="femto pasta">
  __                _                         _
 / _| ___ _ __ ___ | |_ ___    _ __   __ _ ___| |_ __ _
| |_ / _ \ '_ ` _ \| __/ _ \  | '_ \ / _` / __| __/ _` |
|  _|  __/ | | | | | || (_) | | |_) | (_| \__ \ || (_| |
|_|  \___|_| |_| |_|\__\___/  | .__/ \__,_|___/\__\__,_|
                              |_|   every wednesday · 10⁻¹⁵ s per bite</pre>
        <div v-for="(l, i) in boot.slice(0, shown)" :key="i" class="boot">{{ l }}</div>
        <template v-if="shown >= boot.length">
          <div><span class="ok">pasta@femto</span>:<span class="path">~</span>$ sudo ./open-dashboard</div>
          <form class="prompt" @submit.prevent="login(password)">
            <label for="pw">[sudo] password for pasta:</label>
            <input id="pw" ref="input" v-model="password" type="password" autocomplete="current-password" :disabled="busy" spellcheck="false">
            <button class="primary" :disabled="busy || !password">{{ busy ? '…' : '⏎' }}</button>
          </form>
          <div v-if="busy" class="sub">authenticating with the carbohydrate authority<span class="blink">_</span></div>
          <div v-if="error" class="err">{{ error }}</div>
          <div class="sub hint">No password? Scan the QR code on the kitchen wall.</div>
        </template>
      </div>
    </div>
  </main>
</template>

<style scoped>
.door { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
.term { width: min(720px, 100%); background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(127,211,90,.05); }
.bar { display: flex; align-items: center; gap: 7px; padding: 10px 12px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.title { margin-left: 8px; color: var(--muted); font-size: 12px; }
.body { padding: 18px 20px 22px; font-size: 13px; }
.logo { color: var(--pesto); font-size: clamp(6px, 1.75vw, 12px); line-height: 1.25; margin: 0 0 14px; padding-top: 2px; text-shadow: 0 0 12px rgba(127,211,90,.35); overflow-x: auto; overflow-y: hidden; }
.boot { color: var(--muted); }
.path { color: var(--s1); }
.prompt { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 6px 0; }
.prompt label { margin: 0; color: var(--text); font-size: 13px; }
.prompt input { flex: 1; min-width: 140px; background: transparent; border-color: transparent; border-bottom: 1px dashed var(--pesto-dim); border-radius: 0; padding: 4px 2px; }
.prompt input:focus { outline: none; border-bottom-color: var(--pesto); }
.hint { margin-top: 14px; }
</style>
