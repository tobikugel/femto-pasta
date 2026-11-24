#!/usr/bin/env node
// Imports an existing Excel list into the pasta log (pasta.json) and, with --push, commits it
// to the Hugging Face repository.
//
//   node scripts/import-excel.mjs <list.xlsx> [options]
//
//   --sheet <name>      the worksheet (default: the first one)
//   --out <file>        write the log there (default: pasta.json)
//   --merge <file>      start from this existing log instead of an empty one
//   --push              read the current log from Hugging Face, merge the import into it and commit
//                       (needs HF_TOKEN with write access and HF_REPO=<user>/<repo>; HF_FILE, HF_BRANCH optional)
//   --keep-existing     when merging: entries already in the log win over the Excel ones
//   --date YYYY-MM-DD   for a list of totals only (name | servings, no dates): the day they are booked on
//   --no-payments       ignore a Payments sheet
//   --dry-run           only show what was found
//
// Recognised layouts (detected automatically):
//   wide       one row per person, one column per pasta day (header row: dates), cells = servings
//   wide-t     one row per pasta day (first column: dates), one column per person (header row: names)
//   long       one row per entry: date | name | servings (header names in English or German)
//   totals     name | servings (with --date)
// Also read, when present: the price per serving ("Price per … portion | 2" near the top of a sheet) and a
// sheet "Payments" (one row per member; columns "Payment 1", "Payment 2", … are summed into one payment per
// member; a column of credits carried over from an older list becomes a separate payment).
// Cells: numbers are servings; "x", "✓", "ja", "yes" count as 1; empty, 0, "-" mean absent.
import { readFile, writeFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'

const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }
const file = args.find((a, i) => !a.startsWith('--') && !['--sheet', '--out', '--merge', '--date'].includes(args[i - 1]))
if (!file) {
  console.error('usage: node scripts/import-excel.mjs <list.xlsx> [--sheet name] [--out pasta.json] [--merge pasta.json] [--push] [--keep-existing] [--date YYYY-MM-DD] [--dry-run]')
  process.exit(1)
}

// ---------- cell parsing ----------

const iso = d => d.toISOString().slice(0, 10)

/** a cell's plain value (formula results, rich text, hyperlinks unwrapped) */
function plain(v) {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return plain(v.result)
    if ('richText' in v) return v.richText.map(t => t.text).join('')
    if ('text' in v) return v.text
    return null
  }
  return v ?? null
}

/** a date from a cell (Date, Excel serial number, 25.11.2026, 2026-11-25, 25/11/2026, 25.11.26), as YYYY-MM-DD */
function asDate(v) {
  v = plain(v)
  if (v instanceof Date && !Number.isNaN(v.getTime())) return iso(v)
  if (typeof v === 'number' && v > 30000 && v < 80000) return iso(new Date(Date.UTC(1899, 11, 30) + v * 86400000))
  if (typeof v !== 'string') return null
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return mk(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/)
  if (m) return mk(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  return null
}
function mk(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? iso(dt) : null
}

/** servings from a cell, or 0 for absent, or null when it is not a servings cell */
function asServings(v) {
  v = plain(v)
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 4) / 4 : null
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (['', '-', '–', '0', 'no', 'nein', 'n'].includes(s)) return 0
    if (['x', '✓', '✔', 'ja', 'yes', 'y', 'j'].includes(s)) return 1
    const n = Number(s.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 4) / 4 : null
  }
  if (typeof v === 'boolean') return v ? 1 : 0
  return null
}
const asName = v => { v = plain(v); return typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim() : '' }

// ---------- reading the sheet ----------

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(file)
const ws = opt('--sheet') ? wb.getWorksheet(opt('--sheet')) : wb.worksheets[0]
if (!ws) { console.error(`no worksheet ${opt('--sheet') ?? ''}; sheets: ${wb.worksheets.map(w => w.name).join(', ')}`); process.exit(1) }

/** a sheet as a 2-D array of plain values (1-based rows/columns flattened to 0-based) */
function sheetGrid(sheet) {
  const g = []
  sheet.eachRow({ includeEmpty: true }, (row, r) => {
    const cells = []
    row.eachCell({ includeEmpty: true }, (c, col) => { cells[col - 1] = plain(c.value) })
    g[r - 1] = cells
  })
  for (let r = 0; r < g.length; r++) g[r] ??= []
  return g
}
const grid = sheetGrid(ws)

const entries = []
const people = []
const warnings = []
const addPerson = (n) => { if (n && !people.some(p => p.toLowerCase() === n.toLowerCase())) people.push(n) }
const add = (date, name, servings, where) => {
  if (servings === null) { warnings.push(`${where}: not a number of servings, skipped`); return }
  addPerson(name)
  if (servings > 0) entries.push({ date, name, servings, source: 'excel' })
}

const HDR = {
  date: /^(date|datum|day|tag|wednesday|mittwoch|wann)$/i,
  name: /^(name|person|who|wer|eater|esser(in)?|member)$/i,
  servings: /^(servings?|portions?|portion(en)?|anzahl|count|teller|plates?|n|#)$/i,
}
const isTotal = s => /^(total|sum|summe|gesamt|σ|Σ)\b/i.test(s)

/** the name column left of the dates: the one headed "Name"/"Member", else the one with the most text below the header */
function nameColumn(r, texts, firstDateCol) {
  const byHeader = texts.findIndex((t, c) => c < firstDateCol && HDR.name.test(t))
  if (byHeader >= 0) return byHeader
  let best = 0, bestCount = -1
  for (let c = 0; c < firstDateCol; c++) {
    const n = grid.slice(r + 1).filter(row => typeof row[c] === 'string' && row[c].trim()).length
    if (n > bestCount) { best = c; bestCount = n }
  }
  return best
}

function detect() {
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = grid[r]
    const texts = row.map(v => (typeof v === 'string' ? v.trim() : ''))
    const ci = k => texts.findIndex(t => HDR[k].test(t))
    if (ci('date') >= 0 && ci('name') >= 0) return { kind: 'long', r, cols: { date: ci('date'), name: ci('name'), servings: ci('servings') } }
    const dateCols = row.map((v, c) => (asDate(v) ? c : -1)).filter(c => c >= 0)
    if (dateCols.length >= 2) return { kind: 'wide', r, dateCols, nameCol: nameColumn(r, texts, dateCols[0]) }
  }
  // dates down the first column?
  for (let c = 0; c < 3; c++) {
    const rows = grid.map((row, r) => (asDate(row[c]) ? r : -1)).filter(r => r >= 0)
    if (rows.length >= 2) return { kind: 'wide-t', c, rows, headerRow: rows[0] - 1 }
  }
  return { kind: 'totals' }
}

const layout = detect()
console.log(`sheet "${ws.name}": ${layout.kind} layout`)

if (layout.kind === 'long') {
  const { date: dc, name: nc, servings: sc } = layout.cols
  for (let r = layout.r + 1; r < grid.length; r++) {
    const row = grid[r]
    const date = asDate(row[dc]), name = asName(row[nc])
    if (!date || !name || isTotal(name)) { if (row.some(v => v !== null && v !== undefined && v !== '')) warnings.push(`row ${r + 1}: no date or name, skipped`); continue }
    add(date, name, sc >= 0 ? asServings(row[sc]) : 1, `row ${r + 1}`)
  }
}
else if (layout.kind === 'wide') {
  const header = grid[layout.r]
  const nameCol = layout.nameCol
  console.log(`names in column ${String.fromCharCode(65 + nameCol)}, ${layout.dateCols.length} date columns in row ${layout.r + 1}`)
  for (let r = layout.r + 1; r < grid.length; r++) {
    const name = asName(grid[r][nameCol])
    if (!name || isTotal(name)) continue
    for (const c of layout.dateCols) add(asDate(header[c]), name, asServings(grid[r][c]), `row ${r + 1}, column ${c + 1}`)
  }
}
else if (layout.kind === 'wide-t') {
  const header = grid[layout.headerRow] ?? []
  const nameCols = header.map((v, c) => (c !== layout.c && asName(v) && !isTotal(asName(v)) ? c : -1)).filter(c => c >= 0)
  for (const r of layout.rows) {
    for (const c of nameCols) add(asDate(grid[r][layout.c]), asName(header[c]), asServings(grid[r][c]), `row ${r + 1}, column ${c + 1}`)
  }
}
else {
  const date = opt('--date')
  if (!date || !asDate(date)) {
    console.error('No dates found in the sheet. If it only holds totals (name | servings), give the day to book them on with --date YYYY-MM-DD.')
    process.exit(1)
  }
  for (let r = 0; r < grid.length; r++) {
    const name = asName(grid[r][0]), n = asServings(grid[r][1])
    if (!name || isTotal(name) || HDR.name.test(name) || n === null) continue
    add(asDate(date), name, n, `row ${r + 1}`)
  }
}

// ---------- price and payments (optional) ----------

const firstDate = [...new Set(entries.map(e => e.date))].sort()[0] ?? new Date().toISOString().slice(0, 10)
const lastDate = [...new Set(entries.map(e => e.date))].sort().at(-1) ?? firstDate
const prices = []
const payments = []
const money = n => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)

// "Price per … portion | 2" near the top of any sheet
price: for (const sheet of wb.worksheets) {
  const g = sheetGrid(sheet)
  for (const row of g.slice(0, 12)) {
    const c = row.findIndex(v => typeof v === 'string' && /price|preis/i.test(v))
    const n = c >= 0 ? row.slice(c + 1).find(v => typeof v === 'number' && v > 0 && v < 50) : undefined
    if (n !== undefined) { prices.push({ from: firstDate, price: money(n) }); break price }
  }
}

// a sheet called Payments / Zahlungen: one row per member, columns "Payment 1", "Payment 2", … and
// optionally a column of credits carried over from an older list
const paySheet = wb.worksheets.find(w => w !== ws && /payment|zahlung|einzahlung/i.test(w.name))
if (paySheet && !flag('--no-payments')) {
  const g = sheetGrid(paySheet)
  const hr = g.findIndex(row => row.some(v => typeof v === 'string' && HDR.name.test(v.trim())) && row.some(v => typeof v === 'string' && /payment|zahlung/i.test(v)))
  if (hr >= 0) {
    const h = g[hr].map(v => (typeof v === 'string' ? v.trim() : ''))
    const nc = h.findIndex(t => HDR.name.test(t))
    const carry = h.map((t, c) => (/old|carr|previous|übertrag|alt/i.test(t) ? c : -1)).filter(c => c >= 0)
    const pays = h.map((t, c) => (/^(payment|zahlung)\s*\d+/i.test(t) ? c : -1)).filter(c => c >= 0)
    for (let r = hr + 1; r < g.length; r++) {
      const name = asName(g[r][nc])
      if (!name || isTotal(name)) continue
      addPerson(name)
      const slug = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')
      const old = money(carry.reduce((s, c) => s + money(g[r][c]), 0))
      const list = pays.map(c => money(g[r][c])).filter(x => x !== 0)
      const sum = money(list.reduce((s, x) => s + x, 0))
      if (old) payments.push({ id: `excel-${slug}-carryover`, date: firstDate, name, amount: old, note: 'credit carried over from the old list', source: 'excel' })
      if (sum) payments.push({ id: `excel-${slug}-payments`, date: lastDate, name, amount: sum, note: `${list.length} payment${list.length === 1 ? '' : 's'} from the Excel list (net)`, source: 'excel' })
    }
    console.log(`sheet "${paySheet.name}": ${payments.length} payment entries (${carry.length ? 'carried-over credits + ' : ''}${pays.length} payment columns, summed per member)`)
  }
}
if (prices.length) console.log(`price per serving: ${prices[0].price} € (from ${prices[0].from})`)

// ---------- summary ----------

const dates = [...new Set(entries.map(e => e.date))].sort()
const nonWed = dates.filter(d => new Date(`${d}T00:00:00Z`).getUTCDay() !== 3)
const total = entries.reduce((s, e) => s + e.servings, 0)
console.log(`found ${people.length} people, ${entries.length} entries on ${dates.length} days (${dates[0] ?? '–'} … ${dates.at(-1) ?? '–'}), ${total} servings`)
if (nonWed.length) console.log(`note: ${nonWed.length} day(s) are not Wednesdays: ${nonWed.slice(0, 8).join(', ')}${nonWed.length > 8 ? ' …' : ''} (kept as they are)`)
for (const w of warnings.slice(0, 20)) console.log(`warning: ${w}`)
if (warnings.length > 20) console.log(`… and ${warnings.length - 20} more warnings`)
const price = prices[0]?.price ?? 2
const totals = Object.fromEntries(people.map((p) => {
  const servings = entries.filter(e => e.name === p).reduce((s, e) => s + e.servings, 0)
  const paid = money(payments.filter(x => x.name === p).reduce((s, x) => s + x.amount, 0))
  return [p, payments.length ? { servings, 'eaten €': money(servings * price), 'paid €': paid, 'balance €': money(paid - servings * price) } : { servings }]
}))
console.table(totals)
if (flag('--dry-run')) process.exit(0)

// ---------- merging ----------

function merge(base) {
  const log = { version: 1, people: [...(base.people ?? [])], entries: [...(base.entries ?? [])], payments: [...(base.payments ?? [])], prices: [...(base.prices ?? [])] }
  const canon = n => log.people.find(p => p.toLowerCase() === n.toLowerCase()) ?? n
  for (const p of people) if (!log.people.some(q => q.toLowerCase() === p.toLowerCase())) log.people.push(p)
  let added = 0, replaced = 0, kept = 0
  for (const e of entries) {
    const name = canon(e.name)
    const i = log.entries.findIndex(x => x.date === e.date && x.name === name)
    if (i < 0) { log.entries.push({ ...e, name }); added++ }
    else if (flag('--keep-existing')) kept++
    else { log.entries[i] = { ...e, name }; replaced++ }
  }
  log.entries.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  // imported payments have fixed ids: a re-import replaces them instead of adding them twice
  for (const p of payments) {
    const name = canon(p.name)
    const i = log.payments.findIndex(x => x.id === p.id)
    if (i >= 0) log.payments[i] = { ...p, name }
    else log.payments.push({ ...p, name })
  }
  log.payments.sort((a, b) => a.date.localeCompare(b.date))
  for (const p of prices) if (!log.prices.some(x => x.from === p.from)) log.prices.push(p)
  log.prices.sort((a, b) => a.from.localeCompare(b.from))
  if (payments.length || prices.length) console.log(`merge: ${payments.length} payments, ${prices.length} price(s)`)
  log.updatedAt = new Date().toISOString()
  console.log(`merge: ${added} added, ${replaced} replaced, ${kept} kept`)
  return log
}

if (!flag('--push')) {
  const base = opt('--merge') ? JSON.parse(await readFile(opt('--merge'), 'utf8')) : {}
  const out = opt('--out') ?? 'pasta.json'
  await writeFile(out, `${JSON.stringify(merge(base), null, 1)}\n`)
  console.log(`wrote ${out} – upload it to the Hugging Face repository (README: "Import the Excel list"), or run again with --push`)
  process.exit(0)
}

const token = process.env.HF_TOKEN?.trim()
// HF_REPO: user/repo, datasets/user/repo or the repository's URL (dataset or model repository)
const rawRepo = (process.env.HF_REPO ?? '').trim()
let repoPath = rawRepo.replace(/^https?:\/\/(www\.)?huggingface\.co\/?/i, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
let kind = /^datasets\//.test(repoPath) ? 'datasets' : /^models\//.test(repoPath) ? 'models' : repoPath !== rawRepo.replace(/^\/+|\/+$/g, '') ? 'models' : null
repoPath = repoPath.replace(/^(datasets|models)\//, '')
const repo = repoPath.split('/').slice(0, 2).join('/')
const hfFile = process.env.HF_FILE || 'pasta.json', branch = process.env.HF_BRANCH || 'main'
if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) { console.error('--push needs HF_TOKEN (write) and HF_REPO=<user>/<repo>'); process.exit(1) }
const HUB = 'https://huggingface.co'
const auth = { authorization: `Bearer ${token}` }
let rev = await fetch(`${HUB}/api/${kind ?? 'datasets'}/${repo}/revision/${branch}`, { headers: auth })
if (!kind) {
  kind = 'datasets'
  if (rev.status === 404 || rev.status === 401) {
    const other = await fetch(`${HUB}/api/models/${repo}/revision/${branch}`, { headers: auth })
    if (other.ok) { kind = 'models'; rev = other }
  }
}
const fileBase = kind === 'datasets' ? `${HUB}/datasets/${repo}` : `${HUB}/${repo}`
if (!rev.ok) { console.error(`Hugging Face: repository ${repo}: HTTP ${rev.status}`); process.exit(1) }
const { sha } = await rev.json()
const cur = await fetch(`${fileBase}/resolve/${sha}/${hfFile}`, { headers: auth })
const base = cur.ok ? await cur.json() : {}
if (!cur.ok && cur.status !== 404) { console.error(`Hugging Face: ${hfFile}: HTTP ${cur.status}`); process.exit(1) }
const log = merge(base)
const body = [
  { key: 'header', value: { summary: `import ${file.split('/').pop()}`, description: 'scripts/import-excel.mjs', parentCommit: sha } },
  { key: 'file', value: { path: hfFile, content: Buffer.from(`${JSON.stringify(log, null, 1)}\n`).toString('base64'), encoding: 'base64' } },
].map(l => JSON.stringify(l)).join('\n')
const res = await fetch(`${HUB}/api/${kind}/${repo}/commit/${branch}`, { method: 'POST', headers: { ...auth, 'content-type': 'application/x-ndjson' }, body })
if (!res.ok) { console.error(`Hugging Face commit: HTTP ${res.status} ${await res.text()}`); process.exit(1) }
console.log(`committed to ${repo}/${hfFile}: ${(await res.json()).commitUrl ?? 'ok'}`)
