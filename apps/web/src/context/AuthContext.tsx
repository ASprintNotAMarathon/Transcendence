/*
The one place in the app that knows whether someone is logged in.

On mount it asks the server "who am I" (GET /api/auth/me). Because the
session lives in an HttpOnly cookie, the browser sends it automatically;
we never read or store it ourselves. A 401 here just means "nobody is
logged in", not a real error, so it is handled quietly.
*/

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, authApi, type AuthUser, type LoginInput, type RegisterInput } from '../lib/api'

type AuthContextValue = {
  user: AuthUser | null
  status: 'loading' | 'authenticated' | 'anonymous'
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  
  // ⚠️ TODO: @Kimia, this only checks the session once, on startup. If the
  // JWT expires while someone is already using the app, nothing here
  // notices, status stays 'authenticated' until the next page refresh.
  // Suggestion: make the JWT valid for a day or more. The cookie is
  // already HttpOnly, and this is a school project, not production, so a
  // long expiry should be fine. That way this case likely never comes up
  // during testing or the demo, and we don't need to build anything for
  // it. Sound OK, or do you want it shorter?
  //
  // If OK: Kimia sets the expiry where she creates the JWT (apps/api,
  // AuthService). Nothing changes here.
  // If shorter is needed: I add handling here in AuthContext, and in
  // request() in lib/api.ts, so any 401 resets status to 'anonymous'.
  useEffect(() => {
    authApi
      .me()
      .then((me) => {
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        setUser(null)
        setStatus('anonymous')
      })
  }, [])

  async function login(input: LoginInput) {
    const me = await authApi.login(input)
    setUser(me)
    setStatus('authenticated')
  }

  async function register(input: RegisterInput) {
    const me = await authApi.register(input)
    setUser(me)
    setStatus('authenticated')
  }

  async function logout() {
    await authApi.logout()
    setUser(null)
    setStatus('anonymous')
  }

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return ctx
}

export { ApiError }
