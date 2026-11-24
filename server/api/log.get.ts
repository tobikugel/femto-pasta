// The whole pasta log (it is small: a few hundred entries a year)
export default defineEventHandler(async (event) => {
  await requireEater(event)
  setResponseHeader(event, 'cache-control', 'private, no-store')
  return (await readLog(event)).log
})
