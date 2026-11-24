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
//   --dry-run           only show what was found
//
// Recognised layouts (detected automatically):
//   wide       one row per person, one column per pasta day (header row: dates), cells = servings
//   wide-t     one row per pasta day (first column: dates), one column per person (header row: names)
//   long       one row per entry: date | name | servings (header names in English or German)
//   totals     name | servings (with --date)
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

/** the sheet as a 2-D array of plain values (1-based rows/columns flattened to 0-based) */
const grid = []
ws.eachRow({ includeEmpty: true }, (row, r) => {
  const cells = []
  row.eachCell({ includeEmpty: true }, (c, col) => { cells[col - 1] = plain(c.value) })
  grid[r - 1] = cells
})
for (let r = 0; r < grid.length; r++) grid[r] ??= []

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

// ---------- summary ----------

const dates = [...new Set(entries.map(e => e.date))].sort()
const nonWed = dates.filter(d => new Date(`${d}T00:00:00Z`).getUTCDay() !== 3)
const total = entries.reduce((s, e) => s + e.servings, 0)
console.log(`found ${people.length} people, ${entries.length} entries on ${dates.length} days (${dates[0] ?? '–'} … ${dates.at(-1) ?? '–'}), ${total} servings`)
if (nonWed.length) console.log(`note: ${nonWed.length} day(s) are not Wednesdays: ${nonWed.slice(0, 8).join(', ')}${nonWed.length > 8 ? ' …' : ''} (kept as they are)`)
for (const w of warnings.slice(0, 20)) console.log(`warning: ${w}`)
if (warnings.length > 20) console.log(`… and ${warnings.length - 20} more warnings`)
const totals = Object.fromEntries(people.map(p => [p, entries.filter(e => e.name === p).reduce((s, e) => s + e.servings, 0)]))
console.table(totals)
if (flag('--dry-run')) process.exit(0)

// ---------- merging ----------

function merge(base) {
  const log = { version: 1, people: [...(base.people ?? [])], entries: [...(base.entries ?? [])] }
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

const token = process.env.HF_TOKEN, repo = process.env.HF_REPO
const hfFile = process.env.HF_FILE || 'pasta.json', branch = process.env.HF_BRANCH || 'main'
if (!token || !repo) { console.error('--push needs HF_TOKEN (write) and HF_REPO=<user>/<repo>'); process.exit(1) }
const HUB = 'https://huggingface.co'
const auth = { authorization: `Bearer ${token}` }
const rev = await fetch(`${HUB}/api/datasets/${repo}/revision/${branch}`, { headers: auth })
if (!rev.ok) { console.error(`Hugging Face: repository ${repo}: HTTP ${rev.status}`); process.exit(1) }
const { sha } = await rev.json()
const cur = await fetch(`${HUB}/datasets/${repo}/resolve/${sha}/${hfFile}`, { headers: auth })
const base = cur.ok ? await cur.json() : {}
if (!cur.ok && cur.status !== 404) { console.error(`Hugging Face: ${hfFile}: HTTP ${cur.status}`); process.exit(1) }
const log = merge(base)
const body = [
  { key: 'header', value: { summary: `import ${file.split('/').pop()}`, description: 'scripts/import-excel.mjs', parentCommit: sha } },
  { key: 'file', value: { path: hfFile, content: Buffer.from(`${JSON.stringify(log, null, 1)}\n`).toString('base64'), encoding: 'base64' } },
].map(l => JSON.stringify(l)).join('\n')
const res = await fetch(`${HUB}/api/datasets/${repo}/commit/${branch}`, { method: 'POST', headers: { ...auth, 'content-type': 'application/x-ndjson' }, body })
if (!res.ok) { console.error(`Hugging Face commit: HTTP ${res.status} ${await res.text()}`); process.exit(1) }
console.log(`committed to ${repo}/${hfFile}: ${(await res.json()).commitUrl ?? 'ok'}`)
