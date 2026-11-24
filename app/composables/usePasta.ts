// The pasta log in the browser: loaded from /api/log, changed through /api/servings
import type { PastaLog } from '#shared/types/pasta'

export function usePasta() {
  const log = useState<PastaLog | null>('pasta-log', () => null)
  const error = useState<string>('pasta-error', () => '')
  const loading = useState<boolean>('pasta-loading', () => false)

  async function handle<T>(p: Promise<T>): Promise<T> {
    try { return await p }
    catch (e: any) {
      if (e?.statusCode === 401) {
        await useUserSession().fetch()
        await navigateTo('/login')
      }
      throw e
    }
  }

  async function load() {
    loading.value = true
    error.value = ''
    try { log.value = await handle($fetch<PastaLog>('/api/log')) }
    catch (e: any) { error.value = e?.statusMessage || e?.message || 'Could not load the pasta log' }
    finally { loading.value = false }
  }

  async function submit(date: string, name: string, servings: number) {
    log.value = await handle($fetch<PastaLog>('/api/servings', { method: 'POST', body: { date, name, servings } }))
  }

  return { log, error, loading, load, submit }
}
