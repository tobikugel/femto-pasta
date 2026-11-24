// Every page but /login needs the password, or the key from the QR code (?key=… on any page).
// Paths are compared without a trailing slash: Netlify may serve /login as /login/.
export default defineNuxtRouteMiddleware((to) => {
  const path = to.path.replace(/\/+$/, '') || '/'
  if (path === '/login' || useUserSession().loggedIn.value) return
  const key = typeof to.query.key === 'string' ? to.query.key : undefined
  return navigateTo({ path: '/login', query: { ...(key ? { key } : {}), ...(path === '/' ? {} : { next: path }) } })
})
