// Removes a payment (a typo, a double entry); the repository history still has it
export default defineEventHandler(async (event) => {
  await requireEater(event)
  const id = getRouterParam(event, 'id') ?? ''
  return updateLog(event, (log) => {
    const i = log.payments.findIndex(p => p.id === id)
    if (i < 0) throw createError({ statusCode: 404, statusMessage: 'No such payment' })
    log.payments.splice(i, 1)
    return log
  }, `remove payment ${id}`)
})
