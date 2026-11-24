// The pasta log: one JSON file (NUXT_HF_FILE, pasta.json) in a private Hugging Face repository
// (NUXT_HF_REPO: <user>/<repo>, or the repository's URL; a dataset or a model repository both work). Read through the Hub with the token, written with a commit through
// the Hub's commit API. Every change is a commit, so the repository history is the audit log.
// A commit names the commit it builds on (parentCommit): when two people submit at the same time,
// the second one is refused by the Hub, and is retried on top of the first.
//
// Without NUXT_HF_TOKEN (npm run dev), the log is kept in .data/pasta.json instead.
import type { H3Event } from 'h3'
import type { PastaLog } from '#shared/types/pasta'

const HUB = 'https://huggingface.co'
const CACHE_MS = 10_000

interface Snapshot { log: PastaLog, sha: string | null }
let cache: { at: number, snap: Promise<Snapshot> } | null = null

type Kind = 'datasets' | 'models'

/**
 * NUXT_HF_REPO as written: "user/repo", "datasets/user/repo" or a URL
 * (https://huggingface.co/datasets/user/repo, https://huggingface.co/user/repo for a model repository, …).
 * kind null: not said, found out on the first request.
 */
export function parseRepo(raw: string): { repo: string, kind: Kind | null } | null {
  let v = raw.trim().replace(/^https?:\/\/(www\.)?huggingface\.co\/?/i, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
  const isUrl = v !== raw.trim().replace(/^\/+|\/+$/g, '')
  let kind: Kind | null = null
  const m = v.match(/^(datasets|models|spaces)\/(.*)$/)
  if (m) {
    if (m[1] === 'spaces') return null
    kind = m[1] as Kind
    v = m[2]!
  }
  else if (isUrl) kind = 'models'   // https://huggingface.co/user/repo is a model repository
  const parts = v.split('/')
  const repo = parts.slice(0, 2).join('/')   // drops /tree/main, /blob/main/…
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? { repo, kind } : null
}

/** the repository kind found by asking the Hub, per repository */
const foundKind = new Map<string, Kind>()

function settings(event?: H3Event) {
  const c = useRuntimeConfig(event)
  const token = String(c.hfToken ?? '').trim()
  const parsed = parseRepo(String(c.hfRepo ?? ''))
  const file = String(c.hfFile || 'pasta.json')
  const branch = String(c.hfBranch || 'main')
  if (token && !parsed) throw createError({ statusCode: 500, statusMessage: 'NUXT_HF_REPO must be <user>/<repo>, e.g. tobiaskugel/femto-pasta-data' })
  if (!token && !import.meta.dev) throw createError({ statusCode: 500, statusMessage: 'NUXT_HF_TOKEN is not set' })
  const repo = parsed?.repo ?? ''
  return { token, repo, kind: parsed?.kind ?? foundKind.get(repo) ?? null, file, branch }
}

const apiBase = (kind: Kind, repo: string) => `${HUB}/api/${kind}/${repo}`
const fileBase = (kind: Kind, repo: string) => (kind === 'datasets' ? `${HUB}/datasets/${repo}` : `${HUB}/${repo}`)

async function hubError(res: Response, what: string): Promise<never> {
  let detail = ''
  try { detail = ((await res.json()) as { error?: string }).error ?? '' } catch { /* not JSON */ }
  const why = res.status === 401 || res.status === 403 ? 'access denied (check NUXT_HF_TOKEN: write access to the repository?)'
    : res.status === 404 ? 'not found (check NUXT_HF_REPO, NUXT_HF_BRANCH)'
      : `HTTP ${res.status}`
  throw createError({ statusCode: 502, statusMessage: `Hugging Face ${what}: ${why}${detail ? ` – ${detail}` : ''}` })
}

async function readHub(event?: H3Event): Promise<Snapshot> {
  const { token, repo, kind: said, file, branch } = settings(event)
  const auth = { authorization: `Bearer ${token}` }
  // the newest commit of the branch: the file is read at exactly that commit, and the next commit builds on it.
  // Kind not given: a dataset repository, else a model repository of that name.
  let kind: Kind = said ?? 'datasets'
  let rev = await fetch(`${apiBase(kind, repo)}/revision/${encodeURIComponent(branch)}`, { headers: auth })
  if (!said && (rev.status === 404 || rev.status === 401)) {
    const other = await fetch(`${apiBase('models', repo)}/revision/${encodeURIComponent(branch)}`, { headers: auth })
    if (other.ok) { kind = 'models'; rev = other }
  }
  if (!rev.ok) await hubError(rev, `repository ${repo}`)
  foundKind.set(repo, kind)
  const sha = ((await rev.json()) as { sha: string }).sha
  const res = await fetch(`${fileBase(kind, repo)}/resolve/${sha}/${file.split('/').map(encodeURIComponent).join('/')}`, { headers: auth })
  if (res.status === 404) return { log: emptyLog(), sha }   // a fresh repository: the first submission creates the file
  if (!res.ok) await hubError(res, file)
  return { log: normalizeLog(await res.json()), sha }
}

async function commitHub(event: H3Event | undefined, log: PastaLog, parent: string | null, summary: string): Promise<'ok' | 'conflict'> {
  const { token, repo, kind, file, branch } = settings(event)
  const content = Buffer.from(`${JSON.stringify(log, null, 1)}\n`).toString('base64')
  const body = [
    { key: 'header', value: { summary, description: 'via femto-pasta', ...(parent ? { parentCommit: parent } : {}) } },
    { key: 'file', value: { path: file, content, encoding: 'base64' } },
  ].map(l => JSON.stringify(l)).join('\n')
  const res = await fetch(`${apiBase(kind ?? 'datasets', repo)}/commit/${encodeURIComponent(branch)}`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/x-ndjson' },
    body,
  })
  if (res.ok) return 'ok'
  if (res.status === 409 || res.status === 412) return 'conflict'   // somebody else committed in between
  return hubError(res, 'commit')
}

// local development without a token
const LOCAL_KEY = 'pasta.json'
async function readLocal(): Promise<Snapshot> {
  return { log: normalizeLog(await useStorage('data').getItem(LOCAL_KEY)), sha: null }
}

const useHub = (event?: H3Event) => !!settings(event).token

/** the current log (cached for a few seconds) */
export function readLog(event?: H3Event): Promise<Snapshot> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const snap = useHub(event) ? readHub(event) : readLocal()
    cache = { at: Date.now(), snap }
    snap.catch(() => { if (cache?.snap === snap) cache = null })
  }
  return cache.snap
}

/** changes the log (mutate gets the newest one) and saves it; retried when somebody else saved in between */
export async function updateLog(event: H3Event, mutate: (log: PastaLog) => PastaLog, summary: string): Promise<PastaLog> {
  for (let attempt = 0; attempt < 4; attempt++) {
    cache = null
    const { log, sha } = await readLog(event)
    const next = mutate(structuredClone(log))
    next.updatedAt = new Date().toISOString()
    if (!useHub(event)) {
      await useStorage('data').setItem(LOCAL_KEY, next)
      cache = null
      return next
    }
    if (await commitHub(event, next, sha, summary) === 'ok') {
      cache = null
      return next
    }
    await new Promise(r => setTimeout(r, 200 + Math.random() * 400 * (attempt + 1)))
  }
  throw createError({ statusCode: 503, statusMessage: 'Too many people submitting at once – try again' })
}
