// The session of nuxt-auth-utils (server/api/login.post.ts): everybody who knows the password is the same "eater"
declare module '#auth-utils' {
  interface User {
    role: 'eater'
  }
  interface SecureSessionData {
    /** fingerprint of the password at login: a changed NUXT_PASTA_PASSWORD ends every session */
    key: string
  }
}

export {}
