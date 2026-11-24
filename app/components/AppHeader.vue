<script setup lang="ts">
const { loading, load } = usePasta()
const { clear } = useUserSession()
const route = useRoute()

const quotes = [
  'Al dente is a boundary condition.',
  'Pasta is conserved. Mostly.',
  'Σ servings → ∞ as t → Wednesday.',
  'Heisenberg: you can know the sauce or the shape, never both.',
  'Pulse duration: 30 fs. Lunch duration: 30 min.',
  'Spaghetti are just very long, very slow photons.',
  'There is no such thing as a free lunch. It is 2 € per serving.',
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
        <div class="sub">// {{ quote }}</div>
      </div>
    </NuxtLink>
    <nav class="no-print">
      <NuxtLink to="/" class="btn ghost" :class="{ on: route.path === '/' }">⌂ stats</NuxtLink>
      <NuxtLink to="/credits" class="btn ghost" :class="{ on: route.path === '/credits' }">€ credits</NuxtLink>
      <NuxtLink to="/qr" class="btn ghost">▦ QR</NuxtLink>
      <button class="ghost" :disabled="loading" title="reload" @click="load">⟳</button>
      <button class="ghost" @click="logout">exit</button>
    </nav>
  </header>
</template>

<style scoped>
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 22px 0 18px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 14px; color: inherit; text-decoration: none; }
.logo { font-size: 38px; filter: drop-shadow(0 0 10px rgba(243,210,122,.3)); }
h1 { font-size: 26px; }
.accent { color: var(--pesto); }
nav { display: flex; gap: 6px; flex-wrap: wrap; }
nav .btn { text-decoration: none; }
nav .on { border-color: var(--pesto); color: var(--pesto); }
</style>
