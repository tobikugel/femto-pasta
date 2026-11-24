// The pasta log, as stored in the Hugging Face repository (pasta.json)

export interface PastaEntry {
  /** the pasta Wednesday, YYYY-MM-DD */
  date: string
  /** the eater (as in PastaLog.people) */
  name: string
  /** servings eaten that day, 1…MAX_SERVINGS (fractions like 0.5 allowed) */
  servings: number
  /** when it was submitted (ISO time), missing for imported entries */
  at?: string
  /** where it came from */
  source?: 'web' | 'excel'
}

/** money paid into the pasta fund (amount > 0) or paid out of it (amount < 0), in € */
export interface PastaPayment {
  /** unique; imported ones are excel-<name>-<kind>, so a re-import replaces them */
  id: string
  /** YYYY-MM-DD */
  date: string
  name: string
  amount: number
  note?: string
  at?: string
  source?: 'web' | 'excel'
}

/** the price of a serving from a day on (until the next price) */
export interface PastaPrice {
  from: string
  price: number
}

export interface PastaLog {
  version: 1
  /** everybody who ever ate (or was added), in the order they were added */
  people: string[]
  entries: PastaEntry[]
  payments: PastaPayment[]
  /** sorted by from; empty means DEFAULT_PRICE */
  prices: PastaPrice[]
  updatedAt?: string
}
