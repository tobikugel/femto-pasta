<script setup lang="ts">
// The A5 sheet for the kitchen wall: scanning the QR code logs in at once (the key is in the link);
// the password is printed too, for typing it in. Print it with the browser (A5, no margins).
import QRCode from 'qrcode'

const info = ref<{ url: string, site: string, password: string } | null>(null)
const svg = ref('')
const error = ref('')
const print = () => window.print()
onMounted(async () => {
  try {
    info.value = await $fetch('/api/qr')
    svg.value = await QRCode.toString(info.value!.url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#101614', light: '#ffffff00' } })
  }
  catch (e: any) { error.value = e?.statusMessage || 'Could not make the QR code' }
})

// a chirped wave packet – or a strand of spaghetti, depending on the observer
function packet(w: number, h: number, phase: number, amp: number) {
  const pts: string[] = []
  for (let i = 0; i <= 400; i++) {
    const x = (i / 400) * w
    const t = (x - w / 2) / (w * 0.2)
    const env = Math.exp(-t * t)
    const y = h / 2 + amp * env * Math.sin(phase + 0.09 * x + 0.00011 * (x - w / 2) ** 2)
    pts.push(`${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join('')
}
const strands = [packet(560, 60, 0, 24), packet(560, 60, 1.3, 18), packet(560, 60, 2.6, 12)]
</script>

<template>
  <main class="qrpage">
    <div class="no-print bar">
      <NuxtLink to="/">← Back</NuxtLink>
      <span class="sub">A5 sheet for the kitchen. Print it, or save it as PDF: paper size <b>A5</b>, margins <b>none</b>, background graphics <b>on</b>.</span>
      <button class="primary" :disabled="!svg" @click="print">Print / save PDF</button>
    </div>
    <p v-if="error" class="err no-print">{{ error }}</p>

    <article class="sheet">
      <header class="hazard">
        <svg viewBox="0 0 100 88" class="tri" aria-hidden="true">
          <path d="M50 5 L95 83 H5 Z" fill="#f3c623" stroke="#111" stroke-width="6" stroke-linejoin="round" />
          <g stroke="#111" stroke-width="3.4" stroke-linecap="round">
            <line x1="44" y1="56" x2="44" y2="36" /><line x1="44" y1="56" x2="57" y2="45" /><line x1="44" y1="56" x2="31" y2="45" />
            <line x1="44" y1="56" x2="30" y2="60" /><line x1="44" y1="56" x2="53" y2="69" /><line x1="44" y1="56" x2="35" y2="69" />
          </g>
          <circle cx="44" cy="56" r="6" fill="#111" />
          <line x1="50" y1="56" x2="86" y2="56" stroke="#111" stroke-width="4.5" />
        </svg>
        <div>
          <div class="h1">Laser radiation</div>
          <div class="h2">Class 4 pasta · every Wednesday</div>
        </div>
      </header>
      <div class="spectrum" />

      <section class="title">
        <div class="name">femto<span>-pasta</span></div>
        <div class="tag">Had pasta? Log your servings.</div>
      </section>

      <section class="target">
        <span class="c tl" /><span class="c tr" /><span class="c bl" /><span class="c br" />
        <span class="tick t" /><span class="tick b" /><span class="tick l" /><span class="tick r" />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="svg" class="qr" v-html="svg" />
        <div v-else class="qr placeholder">QR</div>
      </section>
      <div class="scan">Scan → you're in. No password needed.</div>

      <ol class="steps">
        <li><b>1</b><span>Scan the code</span></li>
        <li><b>2</b><span>Tap your name</span></li>
        <li><b>3</b><span>Tap your servings</span></li>
      </ol>

      <section class="key">
        <div class="keylabel">No camera? Open <b>{{ info?.site ?? 'the site' }}</b> and enter the interlock key</div>
        <div class="keyval">{{ info?.password ?? '' }}</div>
      </section>

      <svg class="wave" viewBox="0 0 560 60" preserveAspectRatio="none" aria-hidden="true">
        <path v-for="(d, i) in strands" :key="i" :d="d" :class="`s${i}`" />
      </svg>
      <footer class="foot">
        <span>λ = 800 nm · τ = 30 fs · servings → ∞</span>
        <span>Never look into the pot with your remaining eye.</span>
      </footer>
    </article>
  </main>
</template>

<style scoped>
.qrpage { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.bar { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; justify-content: center; max-width: 760px; }

/* the A5 sheet: 148 × 210 mm */
.sheet {
  width: 148mm; height: 210mm; flex: 0 0 auto;
  background: #fff; color: #101614;
  font-family: var(--sans);
  display: flex; flex-direction: column; align-items: center;
  overflow: hidden; position: relative;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
@media (max-width: 600px) { .sheet { zoom: .62; } }

.hazard { align-self: stretch; display: flex; align-items: center; gap: 5mm; padding: 5mm 8mm; background: #f3c623; border-bottom: 1.4mm solid #111; }
.tri { width: 17mm; flex: 0 0 auto; }
.h1 { font-size: 7.2mm; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; line-height: 1; }
.h2 { font-size: 3.6mm; font-weight: 500; margin-top: 1.4mm; }
.spectrum { align-self: stretch; height: 1.6mm; background: var(--spectrum); }

.title { text-align: center; margin-top: 7mm; }
.name { font-size: 12mm; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
.name span { color: #3f9a1f; }
.tag { font-size: 4.4mm; color: #4a5650; margin-top: 2mm; }

/* the QR code in a beam-alignment target */
.target { position: relative; width: 70mm; height: 70mm; margin-top: 7mm; display: grid; place-items: center; }
.qr { width: 58mm; height: 58mm; }
.qr :deep(svg) { width: 100%; height: 100%; display: block; }
.placeholder { display: grid; place-items: center; border: 1px dashed #aaa; color: #aaa; }
.c { position: absolute; width: 9mm; height: 9mm; border: 0 solid #101614; }
.c.tl { left: 0; top: 0; border-left-width: 1.1mm; border-top-width: 1.1mm; }
.c.tr { right: 0; top: 0; border-right-width: 1.1mm; border-top-width: 1.1mm; }
.c.bl { left: 0; bottom: 0; border-left-width: 1.1mm; border-bottom-width: 1.1mm; }
.c.br { right: 0; bottom: 0; border-right-width: 1.1mm; border-bottom-width: 1.1mm; }
.tick { position: absolute; background: #e2372b; }
.tick.t, .tick.b { left: 50%; width: .6mm; height: 3.5mm; transform: translateX(-50%); }
.tick.t { top: -1mm; } .tick.b { bottom: -1mm; }
.tick.l, .tick.r { top: 50%; height: .6mm; width: 3.5mm; transform: translateY(-50%); }
.tick.l { left: -1mm; } .tick.r { right: -1mm; }
.scan { margin-top: 4mm; font-size: 4.2mm; font-weight: 700; }

.steps { list-style: none; padding: 0; margin: 6mm 0 0; display: flex; gap: 7mm; }
.steps li { display: flex; align-items: center; gap: 2mm; font-size: 3.6mm; }
.steps b { width: 6.4mm; height: 6.4mm; border-radius: 50%; display: grid; place-items: center; background: #101614; color: #fff; font-size: 3.6mm; box-shadow: 0 0 0 .7mm #7fd35a; }

.key { margin-top: 7mm; text-align: center; }
.keylabel { font-size: 3.4mm; color: #4a5650; }
.keyval { display: inline-block; margin-top: 2.2mm; padding: 2.4mm 7mm; font-family: var(--mono); font-size: 7mm; font-weight: 600; letter-spacing: .06em; border: .6mm dashed #101614; border-radius: 2.5mm; background: #f4fbef; }

.wave { width: 100%; height: 14mm; margin-top: auto; }
.wave path { fill: none; stroke-linecap: round; }
.wave .s0 { stroke: #e9b949; stroke-width: 2.6; }
.wave .s1 { stroke: #7fd35a; stroke-width: 2; opacity: .85; }
.wave .s2 { stroke: #e2372b; stroke-width: 1.4; opacity: .6; }
.foot { align-self: stretch; display: flex; flex-direction: column; align-items: center; gap: .8mm; padding: 2mm 8mm 5mm; font-size: 2.8mm; color: #6b7570; font-family: var(--mono); }

@media print {
  @page { size: A5 portrait; margin: 0; }
  .qrpage { padding: 0; display: block; }
  .sheet { box-shadow: none; zoom: 1; }
}
</style>
<style>
@media print {
  html, body { background: #fff !important; margin: 0 !important; }
  body { background-image: none !important; }
}
</style>
