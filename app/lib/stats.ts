// All the (more or less) serious statistics of the pasta log. Pure functions, tested in tests/stats.test.ts.
import type { PastaEntry, PastaLog } from '../../shared/types/pasta'
import { addDays, weeksBetween } from '../../shared/utils/pasta'

/** assumptions for the physics corner (per serving) */
export const PHYSICS = {
  /** dry pasta per serving, g */
  grams: 125,
  /** pasta + pesto, kcal */
  kcal: 650,
  /** length of spaghetti n°5 per gram (Ø 1.75 mm, ρ ≈ 1.5 g/cm³), m/g */
  metresPerGram: 0.28,
  /** share of starch in dry pasta */
  starch: 0.72,
  /** Ti:Sapphire laser: wavelength (m), pulse energy (J), repetition rate (Hz) */
  lambda: 800e-9,
  pulseEnergy: 1e-3,
  repRate: 1e3,
  /** basal metabolic power of a human, W */
  humanPower: 80,
}
const H = 6.62607015e-34
const C = 299_792_458
const NA = 6.02214076e23
const KCAL = 4184

export interface PersonStats {
  name: string
  servings: number
  days: number
  /** pasta days since the person's first one */
  possibleDays: number
  attendance: number
  mean: number
  max: number
  maxDate: string | null
  longestStreak: number
  currentStreak: number
  first: string | null
  last: string | null
  /** share of all servings */
  share: number
}

export interface DayStats { date: string, servings: number, eaters: number, top: string | null }

export interface Badge { icon: string, title: string, who: string, why: string }

export interface Stats {
  days: DayStats[]
  people: PersonStats[]
  total: number
  entries: number
  meanPerEntry: number
  stdPerEntry: number
  medianPerEntry: number
  meanPerDay: number
  meanEatersPerDay: number
  recordDay: DayStats | null
  recordEntry: PastaEntry | null
  gini: number
  entropyBits: number
  effectiveEaters: number
  /** servings per week from a least-squares fit of the cumulative total */
  trendPerWeek: number
  trendR2: number
  nextMilestone: { value: number, date: string | null } | null
  histogram: { servings: number, count: number }[]
  physics: ReturnType<typeof physics>
  badges: Badge[]
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Gini coefficient of non-negative values: 0 = everybody eats the same, 1 = one person eats everything */
export function gini(xs: number[]): number {
  const n = xs.length
  const sum = xs.reduce((a, b) => a + b, 0)
  if (n < 2 || sum === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  let acc = 0
  s.forEach((x, i) => { acc += (2 * (i + 1) - n - 1) * x })
  return acc / (n * sum)
}

/** Shannon entropy (bits) of the shares */
export function entropy(xs: number[]): number {
  const sum = xs.reduce((a, b) => a + b, 0)
  if (!sum) return 0
  return -xs.filter(x => x > 0).reduce((h, x) => h + (x / sum) * Math.log2(x / sum), 0)
}

/** least-squares line y = a + b x */
export function linfit(xs: number[], ys: number[]): { a: number, b: number, r2: number } {
  const n = xs.length
  if (n < 2) return { a: ys[0] ?? 0, b: 0, r2: 0 }
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my)
    sxx += (xs[i]! - mx) ** 2
    syy += (ys[i]! - my) ** 2
  }
  const b = sxx ? sxy / sxx : 0
  return { a: my - b * mx, b, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0 }
}

export function physics(servings: number) {
  const p = PHYSICS
  const grams = servings * p.grams
  const joules = servings * p.kcal * KCAL
  const photon = (H * C) / p.lambda
  const metres = grams * p.metresPerGram
  return {
    grams,
    joules,
    kcal: servings * p.kcal,
    /** 800 nm photons with the same energy */
    photons: joules / photon,
    /** how long the Ti:Sa (1 mJ, 1 kHz → 1 W) runs on it, s */
    laserSeconds: joules / (p.pulseEnergy * p.repRate),
    laserPulses: joules / p.pulseEnergy,
    /** spaghetti laid end to end, m */
    metres,
    /** time light needs along that spaghetti, s */
    lightSeconds: metres / C,
    /** glucose units in the starch, mol */
    glucoseMol: (grams * p.starch) / 162.14,
    glucoseUnits: ((grams * p.starch) / 162.14) * NA,
    /** how long one human idles on it, s */
    humanSeconds: joules / p.humanPower,
    /** E = mc², J (the pasta's rest energy) */
    restEnergy: (grams / 1000) * C * C,
  }
}

const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10_000, 1e5]

export function computeStats(log: PastaLog): Stats {
  const entries = log.entries
  const dates = [...new Set(entries.map(e => e.date))].sort()
  const dayIndex = new Map(dates.map((d, i) => [d, i]))

  const days: DayStats[] = dates.map((date) => {
    const es = entries.filter(e => e.date === date)
    const top = es.reduce<PastaEntry | null>((b, e) => (!b || e.servings > b.servings ? e : b), null)
    return { date, servings: es.reduce((s, e) => s + e.servings, 0), eaters: es.length, top: top?.name ?? null }
  })
  const total = days.reduce((s, d) => s + d.servings, 0)

  const names = [...new Set([...log.people, ...entries.map(e => e.name)])]
  const people: PersonStats[] = names.map((name) => {
    const es = entries.filter(e => e.name === name)
    const idx = es.map(e => dayIndex.get(e.date)!).sort((a, b) => a - b)
    let longest = 0, run = 0
    idx.forEach((d, i) => { run = i > 0 && d === idx[i - 1]! + 1 ? run + 1 : 1; longest = Math.max(longest, run) })
    let current = 0
    for (let d = dates.length - 1, j = idx.length - 1; d >= 0 && j >= 0 && idx[j] === d; d--, j--) current++
    const servings = es.reduce((s, e) => s + e.servings, 0)
    const best = es.reduce<PastaEntry | null>((b, e) => (!b || e.servings > b.servings ? e : b), null)
    const possibleDays = idx.length ? dates.length - idx[0]! : 0
    return {
      name,
      servings,
      days: es.length,
      possibleDays,
      attendance: possibleDays ? es.length / possibleDays : 0,
      mean: es.length ? servings / es.length : 0,
      max: best?.servings ?? 0,
      maxDate: best?.date ?? null,
      longestStreak: longest,
      currentStreak: current,
      first: es.length ? dates[idx[0]!]! : null,
      last: es.length ? dates[idx[idx.length - 1]!]! : null,
      share: total ? servings / total : 0,
    }
  }).sort((a, b) => b.servings - a.servings || b.days - a.days || a.name.localeCompare(b.name))

  const per = entries.map(e => e.servings)
  const meanPerEntry = per.length ? total / per.length : 0
  const stdPerEntry = per.length > 1 ? Math.sqrt(per.reduce((s, x) => s + (x - meanPerEntry) ** 2, 0) / (per.length - 1)) : 0

  const hist = new Map<number, number>()
  for (const x of per) hist.set(x, (hist.get(x) ?? 0) + 1)
  const histogram = [...hist].map(([servings, count]) => ({ servings, count })).sort((a, b) => a.servings - b.servings)

  // trend: cumulative servings against weeks since the first pasta day
  let cum = 0
  const xs = days.map(d => weeksBetween(dates[0]!, d.date))
  const ys = days.map(d => (cum += d.servings))
  const fit = linfit(xs, ys)
  const nextValue = MILESTONES.find(m => m > total)
  let nextMilestone: Stats['nextMilestone'] = null
  if (nextValue !== undefined) {
    let date: string | null = null
    if (fit.b > 0 && dates.length >= 2) {
      // from the current total on, at the fitted rate
      const weeks = Math.ceil((nextValue - total) / fit.b)
      date = addDays(dates[dates.length - 1]!, weeks * 7)
    }
    nextMilestone = { value: nextValue, date }
  }

  const totals = people.filter(p => p.servings > 0).map(p => p.servings)
  const h = entropy(totals)
  const recordEntry = entries.reduce<PastaEntry | null>((b, e) => (!b || e.servings > b.servings ? e : b), null)
  const recordDay = days.reduce<DayStats | null>((b, d) => (!b || d.servings > b.servings ? d : b), null)

  return {
    days,
    people,
    total,
    entries: entries.length,
    meanPerEntry,
    stdPerEntry,
    medianPerEntry: median(per),
    meanPerDay: days.length ? total / days.length : 0,
    meanEatersPerDay: days.length ? entries.length / days.length : 0,
    recordDay,
    recordEntry,
    gini: gini(totals),
    entropyBits: h,
    effectiveEaters: 2 ** h,
    trendPerWeek: fit.b,
    trendR2: fit.r2,
    nextMilestone,
    histogram,
    physics: physics(total),
    badges: badges(people.filter(p => p.days > 0), days),
  }
}

function badges(people: PersonStats[], days: DayStats[]): Badge[] {
  if (!people.length) return []
  const out: Badge[] = []
  const best = <T>(xs: T[], f: (x: T) => number) => xs.reduce((b, x) => (f(x) > f(b) ? x : b))
  const worst = <T>(xs: T[], f: (x: T) => number) => xs.reduce((b, x) => (f(x) < f(b) ? x : b))

  const king = people[0]!
  out.push({ icon: '🔆', title: 'Peak Power', who: king.name, why: `${fmt(king.servings)} servings in total` })

  const stomach = best(people, p => p.max)
  out.push({ icon: '💥', title: 'Single-Shot Record', who: stomach.name, why: `${fmt(stomach.max)} servings in one pulse` })

  const streak = best(people, p => p.longestStreak)
  if (streak.longestStreak > 1) out.push({ icon: '🔁', title: 'Mode-Locked', who: streak.name, why: `${streak.longestStreak} pasta days in a row` })

  const regulars = people.filter(p => p.possibleDays >= 3)
  if (regulars.length) {
    const loyal = best(regulars, p => p.attendance)
    out.push({ icon: '〰️', title: 'CW Operation', who: loyal.name, why: `${Math.round(loyal.attendance * 100)} % attendance` })
  }

  const eff = people.filter(p => p.days >= 2)
  if (eff.length > 1) {
    const light = worst(eff, p => p.mean)
    out.push({ icon: '🪶', title: 'Below Threshold', who: light.name, why: `lowest mean: ${fmt(light.mean)} per visit` })
    const heavy = best(eff, p => p.mean)
    if (heavy.name !== light.name) out.push({ icon: '⚡', title: 'Gain Saturated', who: heavy.name, why: `highest mean: ${fmt(heavy.mean)} per visit` })
  }

  const newest = best(people, p => (p.first ? Date.parse(p.first) : 0))
  if (people.length > 1 && newest.first !== days[0]?.date) out.push({ icon: '🌱', title: 'Seed Pulse', who: newest.name, why: `newest eater, since ${newest.first}` })

  const lastDay = days[days.length - 1]?.date
  const ghosts = people.filter(p => p.last && lastDay && p.last !== lastDay && p.days >= 2)
  if (ghosts.length) {
    const ghost = worst(ghosts, p => Date.parse(p.last!))
    out.push({ icon: '🌫️', title: 'Out of Alignment', who: ghost.name, why: `last seen ${ghost.last}` })
  }
  return out
}

export function fmt(x: number, digits = 2): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

/** 1.23 × 10²⁵ */
export function sci(x: number, digits = 2): string {
  if (x === 0) return '0'
  const e = Math.floor(Math.log10(Math.abs(x)))
  if (e >= -2 && e < 4) return fmt(Number(x.toFixed(digits)))
  const m = x / 10 ** e
  return `${m.toFixed(digits)} × 10${String(e).split('').map(c => SUP[c]).join('')}`
}

/** 1.2 k, 3.4 M, … with a unit */
export function si(x: number, unit: string, digits = 3): string {
  const P = [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']] as const
  if (x === 0) return `0 ${unit}`
  const [f, p] = P.find(([f]) => Math.abs(x) >= f) ?? P[P.length - 1]!
  return `${Number((x / f).toPrecision(digits))} ${p}${unit}`
}

/** a duration in human units */
export function duration(s: number): string {
  const units: [number, string][] = [[365.25 * 86400, 'years'], [86400, 'days'], [3600, 'h'], [60, 'min'], [1, 's']]
  for (const [f, u] of units) if (s >= f) return `${Number((s / f).toPrecision(3))} ${u}`
  return si(s, 's')
}
