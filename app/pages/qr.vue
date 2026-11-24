<script setup lang="ts">
// A printable QR code for the kitchen wall: scanning it logs in (the link contains the password)
import QRCode from 'qrcode'

const url = ref('')
const svg = ref('')
const error = ref('')
const print = () => window.print()
onMounted(async () => {
  try {
    url.value = (await $fetch<{ url: string }>('/api/qr')).url
    svg.value = await QRCode.toString(url.value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0d1110', light: '#ffffff' } })
  }
  catch (e: any) { error.value = e?.statusMessage || 'Could not make the QR code' }
})
</script>

<template>
  <main class="wrap qrpage">
    <p class="no-print"><NuxtLink to="/">← dashboard</NuxtLink></p>
    <div class="sheet">
      <h1>🍝 femto-pasta</h1>
      <p class="lead">Had pasta? Scan &amp; log your servings.</p>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="svg" class="qr" v-html="svg" />
      <p v-if="error" class="err">{{ error }}</p>
      <p class="small">every Wednesday · Σ servings → ∞</p>
    </div>
    <p class="sub no-print">Print this page (Ctrl/⌘ + P). Anyone with the code gets in, so keep it in the group's kitchen. Changing NUXT_PASTA_PASSWORD invalidates old prints.</p>
    <button class="no-print primary" @click="print">print</button>
  </main>
</template>

<style scoped>
.qrpage { padding-top: 24px; text-align: center; }
.sheet { background: #fff; color: #0d1110; border-radius: 16px; padding: 32px 24px; max-width: 460px; margin: 0 auto 18px; }
.sheet h1 { font-size: 30px; }
.lead { font-size: 16px; margin: 6px 0 18px; }
.qr { width: min(320px, 100%); margin: 0 auto; }
.qr :deep(svg) { width: 100%; height: auto; display: block; }
.small { font-size: 12px; color: #555; margin-top: 14px; }
@media print { .sheet { box-shadow: none; } }
</style>
