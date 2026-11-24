// The pasta log: one JSON file (NUXT_HF_FILE, pasta.json) in a private Hugging Face dataset
// repository (NUXT_HF_REPO). Read through the Hub with the token, written with a commit through
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

function settings(event?: H3Event) {
  const c = useRuntimeConfig(event)
  const token = String(c.hfToken ?? '')
  const repo = String(c.hfRepo ?? '').replace(/^\/+|\/+$/g, '')
  const file = String(c.hfFile || 'pasta.json')
  const branch = String(c.hfBranch || 'main')
  if (token && !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw createError({ statusCode: 500, statusMessage: 'NUXT_HF_REPO must be <user>/<repo>' })
  if (!token && !import.meta.dev) throw createError({ statusCode: 500, statusMessage: 'NUXT_HF_TOKEN is not set' })
  return { token, repo, file, branch }
}

async function hubError(res: Response, what: string): Promise<never> {
  let detail = ''
  try { detail = ((await res.json()) as { error?: string }).error ?? '' } catch { /* not JSON */ }
  const why = res.status === 401 || res.status === 403 ? 'access denied (check NUXT_HF_TOKEN: write access to the repository?)'
    : res.status === 404 ? 'not found (check NUXT_HF_REPO, NUXT_HF_BRANCH)'
      : `HTTP ${res.status}`
  throw createError({ statusCode: 502, statusMessage: `Hugging Face ${what}: ${why}${detail ? ` – ${detail}` : ''}` })
}

async function readHub(event?: H3Event): Promise<Snapshot> {
  const { token, repo, file, branch } = settings(event)
  const auth = { authorization: `Bearer ${token}` }
  // the newest commit of the branch: the file is read at exactly that commit, and the next commit builds on it
  const rev = await fetch(`${HUB}/api/datasets/${repo}/revision/${encodeURIComponent(branch)}`, { headers: auth })
  if (!rev.ok) await hubError(rev, 'repository')
  const sha = ((await rev.json()) as { sha: string }).sha
  const res = await fetch(`${HUB}/datasets/${repo}/resolve/${sha}/${file.split('/').map(encodeURIComponent).join('/')}`, { headers: auth })
  if (res.status === 404) return { log: emptyLog(), sha }   // a fresh repository: the first submission creates the file
  if (!res.ok) await hubError(res, file)
  return { log: normalizeLog(await res.json()), sha }
}

async function commitHub(event: H3Event | undefined, log: PastaLog, parent: string | null, summary: string): Promise<'ok' | 'conflict'> {
  const { token, repo, file, branch } = settings(event)
  const content = Buffer.from(`${JSON.stringify(log, null, 1)}\n`).toString('base64')
  const body = [
    { key: 'header', value: { summary, description: 'via femto-pasta', ...(parent ? { parentCommit: parent } : {}) } },
    { key: 'file', value: { path: file, content, encoding: 'base64' } },
  ].map(l => JSON.stringify(l)).join('\n')
  const res = await fetch(`${HUB}/api/datasets/${repo}/commit/${encodeURIComponent(branch)}`, {
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
