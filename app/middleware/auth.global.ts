// Every page but /login needs the password (or the QR code). The rest of the query is kept.
export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/login' && !useUserSession().loggedIn.value) {
    return navigateTo({ path: '/login', query: to.path === '/' ? {} : { next: to.path } })
  }
})
