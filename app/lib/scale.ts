// Small helpers for the hand-made SVG charts

/** linear map of [d0, d1] to [r0, r1] */
export const linear = (d0: number, d1: number, r0: number, r1: number) =>
  (x: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((x - d0) / (d1 - d0)) * (r1 - r0))

/** about n round tick values from 0 to max */
export function ticks(max: number, n = 4): number[] {
  if (max <= 0) return [0]
  const raw = max / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw)!
  const out: number[] = []
  for (let v = 0; v <= max + step * 1e-9; v += step) out.push(Number(v.toPrecision(10)))
  if (out[out.length - 1]! < max) out.push(Number((out[out.length - 1]! + step).toPrecision(10)))
  return out
}

/** 2026-11-18 → 18 Nov */
export function shortDate(s: string, withYear = false): string {
  const d = new Date(`${s}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: '2-digit' } : {}), timeZone: 'UTC' })
}

/** colour slot of a person: fixed by their position in the overall ranking, never by the current view */
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)']

/** a bar from the baseline y0 up to y, with 4px rounded top corners */
export function barPath(x: number, w: number, y: number, y0: number, r = 4): string {
  const h = y0 - y
  if (h <= 0 || w <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y0}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y0}Z`
}
