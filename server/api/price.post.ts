// Sets the price of a serving from a day on (earlier pasta keeps its old price)
export default defineEventHandler(async (event) => {
  await requireEater(event)
  const body = await readBody<{ from?: unknown, price?: unknown }>(event)
  const from = typeof body?.from === 'string' ? body.from : ''
  const price = typeof body?.price === 'string' ? Number(body.price) : body?.price
  if (!parseIsoDate(from)) throw createError({ statusCode: 400, statusMessage: 'Date: YYYY-MM-DD' })
  if (!validPrice(price) || price > 50) throw createError({ statusCode: 400, statusMessage: 'Price: more than 0, at most 50 €, in cents' })
  return updateLog(event, log => setPrice(log, from, price), `price ${price.toFixed(2)} € per serving from ${from}`)
})
