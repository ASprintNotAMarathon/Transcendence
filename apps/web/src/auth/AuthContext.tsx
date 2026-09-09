/*
AuthContext.tsx
 
Holds two things: who is logged in right now (user + status), and three
functions to change that (login, register, logout). Every other file
reads this instead of talking to the server directly.
 
Exports:
- AuthProvider: wrap the app in this once, done already in main.tsx
- useAuth(): call this in any component to read user/status, or to call
  login/register/logout
 
When app starts, it asks the server "who am I" (GET /api/auth/me).
The session lives in an HttpOnly cookie, the browser sends it
automatically, we never read / store it.
 
A 401 here just means nobody's logged in, don't treat it as an error.
*/

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, authApi, type AuthUser, type LoginInput, type RegisterInput } from '../lib/api'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthState = {
  user: AuthUser | null
  status: AuthStatus
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

// Checks session once, on startup. According to our auth contract: JWT
// lifetime is 24h --> longer than play session, so expiry doesn't happen
// during demo. Logout only clears browser's cookie, it can't
// cancel the token, a copy elsewhere stays valid. We are aware of this
// 'limitation'.
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
