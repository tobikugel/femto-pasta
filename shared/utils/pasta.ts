// Helpers used by the pages and the server alike (auto-imported from shared/utils)
import type { PastaEntry, PastaLog } from '../types/pasta'

export const MAX_SERVINGS = 20
export const MAX_NAME_LENGTH = 40

export const emptyLog = (): PastaLog => ({ version: 1, people: [], entries: [] })

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** YYYY-MM-DD of a local date */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** the Date (UTC midnight) of a YYYY-MM-DD, or null */
export function parseIsoDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d
}

export const isWednesday = (s: string) => parseIsoDate(s)?.getUTCDay() === 3

/** today if it is a Wednesday, else the last Wednesday before it */
export function lastWednesday(today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  d.setDate(d.getDate() - ((d.getDay() - 3 + 7) % 7))
  return isoDate(d)
}

/** YYYY-MM-DD plus n days */
export function addDays(s: string, n: number): string {
  const d = parseIsoDate(s)!
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** whole weeks from a to b (both Wednesdays) */
export const weeksBetween = (a: string, b: string) =>
  Math.round((parseIsoDate(b)!.getTime() - parseIsoDate(a)!.getTime()) / (7 * 86_400_000))

/** trimmed, single spaces */
export const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim()

/** the spelling already in the log of a name (case-insensitive), or the name itself */
export function canonicalName(people: string[], name: string): string {
  const n = cleanName(name)
  return people.find(p => p.toLowerCase() === n.toLowerCase()) ?? n
}

export function validServings(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= MAX_SERVINGS && Math.round(x * 4) === x * 4
}

/**
 * Sets the servings of a person on a day (0 removes the entry), adding the person if new.
 * Mutates and returns the log.
 */
export function upsertEntry(log: PastaLog, e: PastaEntry): PastaLog {
  const name = canonicalName(log.people, e.name)
  if (!log.people.includes(name)) log.people.push(name)
  const i = log.entries.findIndex(x => x.date === e.date && x.name === name)
  if (e.servings === 0) {
    if (i >= 0) log.entries.splice(i, 1)
  }
  else if (i >= 0) log.entries[i] = { ...e, name }
  else log.entries.push({ ...e, name })
  log.entries.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  return log
}

/** checks a log read from the repository (or an import) and drops what is broken */
export function normalizeLog(raw: unknown): PastaLog {
  const log = emptyLog()
  if (!raw || typeof raw !== 'object') return log
  const r = raw as Partial<PastaLog>
  for (const p of Array.isArray(r.people) ? r.people : []) {
    if (typeof p === 'string' && cleanName(p) && !log.people.some(q => q.toLowerCase() === cleanName(p).toLowerCase())) log.people.push(cleanName(p))
  }
  for (const e of Array.isArray(r.entries) ? r.entries : []) {
    if (!e || typeof e.name !== 'string' || typeof e.date !== 'string' || !parseIsoDate(e.date) || !validServings(e.servings) || e.servings === 0) continue
    upsertEntry(log, { date: e.date, name: e.name, servings: e.servings, ...(e.at ? { at: e.at } : {}), ...(e.source ? { source: e.source } : {}) })
  }
  if (typeof r.updatedAt === 'string') log.updatedAt = r.updatedAt
  return log
}
