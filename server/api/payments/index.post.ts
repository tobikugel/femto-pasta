// Logs money paid into the pasta fund (amount > 0) or paid out of it (amount < 0)
export default defineEventHandler(async (event) => {
  await requireEater(event)
  const body = await readBody<{ date?: unknown, name?: unknown, amount?: unknown, note?: unknown }>(event)
  const date = typeof body?.date === 'string' ? body.date : ''
  const name = typeof body?.name === 'string' ? cleanName(body.name) : ''
  const amount = typeof body?.amount === 'string' ? Number(body.amount) : body?.amount
  const note = typeof body?.note === 'string' ? cleanName(body.note).slice(0, MAX_NOTE_LENGTH) : ''

  if (!parseIsoDate(date)) throw createError({ statusCode: 400, statusMessage: 'Date: YYYY-MM-DD' })
  if (date > addDays(new Date().toISOString().slice(0, 10), 1)) throw createError({ statusCode: 400, statusMessage: 'No payments from the future' })
  if (!name || name.length > MAX_NAME_LENGTH) throw createError({ statusCode: 400, statusMessage: `Name: 1–${MAX_NAME_LENGTH} characters` })
  if (!validAmount(amount)) throw createError({ statusCode: 400, statusMessage: `Amount: not 0, at most ${MAX_AMOUNT} €, in cents` })

  return updateLog(event, log => addPayment(log, { id: newId(), date, name, amount, ...(note ? { note } : {}), at: new Date().toISOString(), source: 'web' }),
    `${date}: ${name} ${amount > 0 ? 'paid' : 'got'} ${Math.abs(amount).toFixed(2)} €`)
})
