import { describe, expect, it } from 'vitest'
import { computeCredits, euro } from '../app/lib/credits'
import { addPayment, normalizeLog, priceOn, setPrice, validAmount } from '../shared/utils/pasta'

describe('prices and amounts', () => {
  it('priceOn uses the latest price before the day', () => {
    const prices = [{ from: '2026-01-07', price: 2.5 }, { from: '2026-06-03', price: 3 }]
    expect(priceOn(prices, '2025-12-31')).toBe(2)
    expect(priceOn(prices, '2026-01-07')).toBe(2.5)
    expect(priceOn(prices, '2026-11-18')).toBe(3)
  })
  it('validAmount', () => {
    expect(validAmount(14.28)).toBe(true)
    expect(validAmount(-8)).toBe(true)
    expect(validAmount(0)).toBe(false)
    expect(validAmount(1.234)).toBe(false)
  })
  it('euro', () => {
    expect(euro(-12.5)).toBe('−12.50 €')
    expect(euro(3, true)).toBe('+3.00 €')
  })
})

describe('computeCredits', () => {
  const log = normalizeLog({
    people: ['Anna', 'Ben', 'Cleo'],
    entries: [
      { date: '2026-01-07', name: 'Anna', servings: 2 },
      { date: '2026-01-07', name: 'Ben', servings: 1 },
      { date: '2026-01-14', name: 'Anna', servings: 1 },
    ],
    payments: [
      { id: 'a', date: '2026-01-01', name: 'Anna', amount: 10 },
      { id: 'b', date: '2026-01-01', name: 'Ben', amount: -1 },
    ],
  })
  setPrice(log, '2026-01-14', 3)
  it('balances with the price on each day', () => {
    const c = computeCredits(log, '2026-01-21')
    const anna = c.accounts.find(a => a.name === 'Anna')!
    expect(anna.spent).toBe(2 * 2 + 3)
    expect(anna.balance).toBe(3)
    expect(anna.runway).toBeCloseTo(3 / (1.5 * 3))
    const ben = c.accounts[0]!
    expect(ben.name).toBe('Ben')
    expect(ben.balance).toBe(-3)
    expect(c.accounts.some(a => a.name === 'Cleo')).toBe(false)
    expect(c.fund).toBe(0)
    expect(c.debtors).toBe(1)
  })
  it('addPayment replaces by id', () => {
    addPayment(log, { id: 'a', date: '2026-01-01', name: 'anna', amount: 20 })
    expect(log.payments.filter(p => p.name === 'Anna')).toHaveLength(1)
    expect(computeCredits(log, '2026-01-21').accounts.find(a => a.name === 'Anna')!.paid).toBe(20)
  })
})
