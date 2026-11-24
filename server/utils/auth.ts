// The shared password (NUXT_PASTA_PASSWORD). Everybody who knows it, or scanned the QR code, is an "eater".
import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const sha = (s: string) => createHash('sha256').update(s).digest()

export function pastaPassword(event?: H3Event): string {
  const pw = String(useRuntimeConfig(event).pastaPassword ?? '')
  if (!pw) throw createError({ statusCode: 500, statusMessage: 'NUXT_PASTA_PASSWORD is not set' })
  return pw
}

/** constant-time comparison with the password */
export const checkPassword = (event: H3Event, given: string) => timingSafeEqual(sha(given), sha(pastaPassword(event)))

/** what the session remembers of the password: a new password logs everybody out */
export const sessionKey = (event: H3Event) => sha(`femto-pasta:${pastaPassword(event)}`).toString('hex').slice(0, 16)

/** a 401 unless logged in with the current password */
export async function requireEater(event: H3Event) {
  const session = await requireUserSession(event)
  if (session.secure?.key !== sessionKey(event)) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session.user
}
