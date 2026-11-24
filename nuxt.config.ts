// https://nuxt.com/docs/api/configuration/nuxt-config
// Same setup as 3d-vmi: the pages are static files (ssr: false), the server API in server/
// (login, reading and writing the pasta log on Hugging Face) becomes a Netlify function.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  ssr: false,
  modules: ['nuxt-auth-utils'],
  runtimeConfig: {
    // server only (Netlify environment variables, or .env locally), never sent to the browser:
    /** NUXT_PASTA_PASSWORD: the shared password of the group (the QR code logs in with it too) */
    pastaPassword: '',
    /** NUXT_HF_TOKEN: a Hugging Face token with WRITE access to the data repository */
    hfToken: '',
    /** NUXT_HF_REPO: the private dataset repository, <user>/<repo> */
    hfRepo: '',
    /** NUXT_HF_FILE: the file in that repository that holds the log */
    hfFile: 'pasta.json',
    /** NUXT_HF_BRANCH */
    hfBranch: 'main',
  },
  nitro: { prerender: { routes: ['/', '/login', '/qr', '/credits'] } },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'femto-pasta // carb tracker',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Weekly pasta Wednesday tracker of the femto lab' },
        { name: 'theme-color', content: '#0d1110' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap' },
      ],
    },
  },
})
