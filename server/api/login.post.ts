// Log in with the shared password (typed in, or from the QR code: /login?key=…)
export default defineEventHandler(async (event) => {
  const body = await readBody<{ password?: unknown }>(event)
  const password = typeof body?.password === 'string' ? body.password.trim() : ''
  if (!password) throw createError({ statusCode: 400, statusMessage: 'Password is required' })
  if (!checkPassword(event, password)) {
    await new Promise(r => setTimeout(r, 600))   // makes guessing a little slower
    throw createError({ statusCode: 401, statusMessage: 'Wrong password' })
  }
  await setUserSession(event, { user: { role: 'eater' }, secure: { key: sessionKey(event) }, loggedInAt: Date.now() }, { maxAge: 60 * 60 * 24 * 180 })
  return { ok: true }
})
