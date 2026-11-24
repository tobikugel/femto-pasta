<script setup lang="ts">
const { loading, load } = usePasta()
const { clear } = useUserSession()
const route = useRoute()

const quotes = [
  'Never look into the pasta pot with your remaining eye.',
  'Pulse duration: 30 fs. Lunch duration: 30 min.',
  'Chirped pasta amplification: stretch, amplify, compress, eat.',
  'Spaghetti are just very long, very slow photons.',
  'Δt · Δν ≥ 0.44 – the time–bandwidth product of lunch.',
  'Mode-locked every Wednesday since 2025.',
  'Al dente is a phase-matching condition.',
  'Pesto: the gain medium of the group.',
]
const quote = quotes[Math.floor(Date.now() / 86_400_000) % quotes.length]

async function logout() {
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <header class="top">
    <NuxtLink to="/" class="brand">
      <span class="logo" aria-hidden="true">🍝</span>
      <div>
        <h1>femto<span class="accent">-pasta</span></h1>
        <div class="sub">{{ quote }}</div>
      </div>
    </NuxtLink>
    <nav class="no-print">
      <NuxtLink to="/" class="btn ghost" :class="{ on: route.path === '/' }">Dashboard</NuxtLink>
      <NuxtLink to="/credits" class="btn ghost" :class="{ on: route.path === '/credits' }">Credits</NuxtLink>
      <NuxtLink to="/qr" class="btn ghost">QR code</NuxtLink>
      <button class="ghost" :disabled="loading" title="reload the data" @click="load">↻</button>
      <button class="ghost" title="log out" @click="logout">Close shutter</button>
    </nav>
  </header>
  <div class="spectrum" aria-hidden="true"><span>400 nm</span><span>800 nm</span></div>
</template>

<style scoped>
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 22px 0 14px; flex-wrap: wrap; }
.spectrum { position: relative; height: 3px; border-radius: 2px; background: var(--spectrum); margin-bottom: 22px; box-shadow: 0 0 14px rgba(0, 230, 118, .25); }
.spectrum span { position: absolute; top: 6px; font-family: var(--mono); font-size: 10px; color: var(--muted); }
.spectrum span:last-child { right: 0; }
.brand { display: flex; align-items: center; gap: 14px; color: inherit; text-decoration: none; }
.logo { font-size: 38px; filter: drop-shadow(0 0 10px rgba(243,210,122,.3)); }
h1 { font-size: 26px; letter-spacing: -.02em; }
.accent { color: var(--pesto); text-shadow: 0 0 16px rgba(127,211,90,.45); }
nav { display: flex; gap: 6px; flex-wrap: wrap; }
nav .btn { text-decoration: none; }
nav .on { border-color: var(--pesto); color: var(--pesto); }
</style>
