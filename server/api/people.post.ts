// Adds a person to the list without servings (e.g. a new group member)
export default defineEventHandler(async (event) => {
  await requireEater(event)
  const body = await readBody<{ name?: unknown }>(event)
  const name = typeof body?.name === 'string' ? cleanName(body.name) : ''
  if (!name || name.length > MAX_NAME_LENGTH) throw createError({ statusCode: 400, statusMessage: `Name: 1–${MAX_NAME_LENGTH} characters` })
  return updateLog(event, (log) => {
    const n = canonicalName(log.people, name)
    if (!log.people.includes(n)) log.people.push(n)
    return log
  }, `add ${name}`)
})
