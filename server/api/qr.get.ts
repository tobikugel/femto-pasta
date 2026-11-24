// What the printed QR sheet needs: the link in the QR code (opens the site and logs in at once, the key
// is in the link), the site's address and the password for typing it in by hand
export default defineEventHandler(async (event) => {
  await requireEater(event)
  const { origin, host } = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
  const password = pastaPassword(event)
  return { url: `${origin}/login?key=${encodeURIComponent(password)}`, site: host, password }
})
