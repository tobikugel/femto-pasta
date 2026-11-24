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

export interface PastaLog {
  version: 1
  /** everybody who ever ate (or was added), in the order they were added */
  people: string[]
  entries: PastaEntry[]
  updatedAt?: string
}
