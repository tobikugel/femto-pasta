// Money: what everybody paid, what their pasta cost (servings × the price on that day), and the balance.
// Pure functions, tested in tests/credits.test.ts.
import type { PastaLog } from '../../shared/types/pasta'
import { priceOn } from '../../shared/utils/pasta'

export interface Account {
  name: string
  paid: number
  spent: number
  servings: number
  /** paid − spent: > 0 credit, < 0 debt */
  balance: number
  /** € a usual pasta Wednesday costs this person (mean servings per pasta day since joining × current price) */
  burnPerWeek: number
  /** pasta Wednesdays the credit lasts at that rate (null: no credit, or not eating) */
  runway: number | null
  lastPayment: string | null
}

export interface Credits {
  accounts: Account[]
  totalPaid: number
  totalSpent: number
  /** Σ balances: what the fund holds (> 0) or is owed (< 0) */
  fund: number
  debt: number
  credit: number
  debtors: number
  price: number
}

const cents = (x: number) => Math.round(x * 100) / 100

export function computeCredits(log: PastaLog, today: string): Credits {
  const names = [...new Set([...log.people, ...log.entries.map(e => e.name), ...log.payments.map(p => p.name)])]
  const dates = [...new Set(log.entries.map(e => e.date))].sort()
  const price = priceOn(log.prices, today)

  const accounts: Account[] = names.map((name) => {
    const es = log.entries.filter(e => e.name === name)
    const ps = log.payments.filter(p => p.name === name)
    const paid = cents(ps.reduce((s, p) => s + p.amount, 0))
    const spent = cents(es.reduce((s, e) => s + e.servings * priceOn(log.prices, e.date), 0))
    const servings = es.reduce((s, e) => s + e.servings, 0)
    const first = es.map(e => e.date).sort()[0]
    const daysSince = first ? dates.filter(d => d >= first).length : 0
    const burnPerWeek = daysSince ? (servings / daysSince) * price : 0
    const balance = cents(paid - spent)
    return {
      name,
      paid,
      spent,
      servings,
      balance,
      burnPerWeek,
      runway: balance > 0 && burnPerWeek > 0 ? balance / burnPerWeek : null,
      lastPayment: ps.map(p => p.date).sort().at(-1) ?? null,
    }
  }).filter(a => a.paid !== 0 || a.spent !== 0)
    .sort((a, b) => a.balance - b.balance || a.name.localeCompare(b.name))

  const totalPaid = cents(accounts.reduce((s, a) => s + a.paid, 0))
  const totalSpent = cents(accounts.reduce((s, a) => s + a.spent, 0))
  return {
    accounts,
    totalPaid,
    totalSpent,
    fund: cents(totalPaid - totalSpent),
    debt: cents(accounts.filter(a => a.balance < 0).reduce((s, a) => s - a.balance, 0)),
    credit: cents(accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0)),
    debtors: accounts.filter(a => a.balance < 0).length,
    price,
  }
}

/** −12.5 → "−12.50 €" */
export function euro(x: number, sign = false): string {
  const s = Math.abs(x).toFixed(2)
  return `${x < 0 ? '−' : sign && x > 0 ? '+' : ''}${s} €`
}
