/*
The place in the app that knows if someone is logged in.
 
When app starts, it asks the server "who am I" (GET /api/auth/me).
The session lives in an HttpOnly cookie, the browser sends it 
automatically, we never read / store it. 

A 401 here just means nobody's logged in, don't treat it as an error.

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

  // Checks the session once, on startup. According our Auth contract: the
  // JWT is ~12h (longer than a play session) so it never expires 
  // during the demo
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
