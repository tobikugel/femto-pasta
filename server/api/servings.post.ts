// Sets the servings of one person on one pasta Wednesday (0 removes the entry); re-submitting overwrites
export default defineEventHandler(async (event) => {
  await requireEater(event)
  const body = await readBody<{ date?: unknown, name?: unknown, servings?: unknown }>(event)
  const date = typeof body?.date === 'string' ? body.date : ''
  const name = typeof body?.name === 'string' ? cleanName(body.name) : ''
  const servings = typeof body?.servings === 'string' ? Number(body.servings) : body?.servings

  if (!isWednesday(date)) throw createError({ statusCode: 400, statusMessage: 'The date must be a Wednesday (YYYY-MM-DD)' })
  // a day of slack for time zones
  if (date > addDays(new Date().toISOString().slice(0, 10), 1)) throw createError({ statusCode: 400, statusMessage: 'No pasta from the future' })
  if (!name || name.length > MAX_NAME_LENGTH) throw createError({ statusCode: 400, statusMessage: `Name: 1–${MAX_NAME_LENGTH} characters` })
  if (!validServings(servings)) throw createError({ statusCode: 400, statusMessage: `Servings: 0–${MAX_SERVINGS}, in steps of ¼` })

  return updateLog(event, log => upsertEntry(log, { date, name, servings, at: new Date().toISOString(), source: 'web' }),
    servings === 0 ? `${date}: remove ${name}` : `${date}: ${name} ate ${servings}`)
})
