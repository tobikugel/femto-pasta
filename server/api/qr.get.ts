// The link in the QR code: opens the site and logs in with the password
export default defineEventHandler(async (event) => {
  await requireEater(event)
  const { origin } = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
  return { url: `${origin}/login?key=${encodeURIComponent(pastaPassword(event))}` }
})
