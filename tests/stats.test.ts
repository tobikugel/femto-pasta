import { describe, expect, it } from 'vitest'
import { computeStats, gini, entropy, linfit, sci } from '../app/lib/stats'
import { lastWednesday, normalizeLog, upsertEntry, emptyLog, isWednesday } from '../shared/utils/pasta'

describe('helpers', () => {
  it('gini', () => {
    expect(gini([1, 1, 1, 1])).toBe(0)
    expect(gini([0, 0, 0, 4])).toBeCloseTo(0.75)
  })
  it('entropy', () => {
    expect(entropy([1, 1])).toBeCloseTo(1)
    expect(entropy([1, 1, 1, 1])).toBeCloseTo(2)
  })
  it('linfit', () => {
    const f = linfit([0, 1, 2], [1, 3, 5])
    expect(f.b).toBeCloseTo(2)
    expect(f.r2).toBeCloseTo(1)
  })
  it('sci', () => {
    expect(sci(1.234e25)).toBe('1.23 × 10²⁵')
    expect(sci(12.5)).toBe('12.5')
  })
  it('wednesdays', () => {
    expect(lastWednesday(new Date(2026, 10, 25))).toBe('2026-11-25')
    expect(lastWednesday(new Date(2026, 10, 24))).toBe('2026-11-18')
    expect(isWednesday('2026-11-25')).toBe(true)
    expect(isWednesday('2026-11-26')).toBe(false)
  })
})

describe('log', () => {
  it('upsert overwrites, matches names case-insensitively, 0 removes', () => {
    const log = emptyLog()
    upsertEntry(log, { date: '2026-11-18', name: 'Anna', servings: 1 })
    upsertEntry(log, { date: '2026-11-18', name: ' anna ', servings: 2 })
    expect(log.entries).toEqual([{ date: '2026-11-18', name: 'Anna', servings: 2 }])
    upsertEntry(log, { date: '2026-11-18', name: 'ANNA', servings: 0 })
    expect(log.entries).toEqual([])
    expect(log.people).toEqual(['Anna'])
  })
  it('normalize drops junk', () => {
    const log = normalizeLog({ people: ['A', 'a', 3], entries: [{ date: '2026-02-30', name: 'A', servings: 1 }, { date: '2026-11-18', name: 'B', servings: 1.5 }] })
    expect(log.people).toEqual(['A', 'B'])
    expect(log.entries).toHaveLength(1)
  })
})

describe('computeStats', () => {
  const log = normalizeLog({
    people: ['Anna', 'Ben', 'Cleo'],
    entries: [
      { date: '2026-11-04', name: 'Anna', servings: 2 },
      { date: '2026-11-04', name: 'Ben', servings: 1 },
      { date: '2026-11-11', name: 'Anna', servings: 3 },
      { date: '2026-11-18', name: 'Anna', servings: 1 },
      { date: '2026-11-18', name: 'Ben', servings: 1 },
    ],
  })
  const s = computeStats(log)
  it('totals and people', () => {
    expect(s.total).toBe(8)
    expect(s.days.map(d => d.servings)).toEqual([3, 3, 2])
    const anna = s.people[0]!
    expect(anna.name).toBe('Anna')
    expect(anna.longestStreak).toBe(3)
    expect(anna.currentStreak).toBe(3)
    expect(anna.max).toBe(3)
    const ben = s.people.find(p => p.name === 'Ben')!
    expect(ben.longestStreak).toBe(1)
    expect(ben.attendance).toBeCloseTo(2 / 3)
    expect(s.people.find(p => p.name === 'Cleo')!.days).toBe(0)
  })
  it('trend and milestone', () => {
    expect(s.trendPerWeek).toBeCloseTo(2.5)
    expect(s.nextMilestone?.value).toBe(10)
    expect(s.nextMilestone?.date).toBe('2026-11-25')
  })
  it('badges', () => {
    expect(s.badges.find(b => b.title === 'Carbonara Kaiser')?.who).toBe('Anna')
  })
})
