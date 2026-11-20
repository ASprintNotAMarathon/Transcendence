/*
AuthContext.tsx
 
Holds two things: who is logged in right now (user + status), and three
functions to change that (login, register, logout). Every other file
reads this instead of talking to the server directly.
 
Exports:
- AuthProvider: wrap the app in this once, done already in main.tsx
- useAuth(): call this in any component to read user/status, or to call
  login/register/logout
 
When app starts, it asks the server "who am I" (GET /api/auth/session).
The session lives in an HttpOnly cookie, the browser sends it
automatically, we never read / store it.

It answers 200 either way: { user: null } just means nobody's logged in.
We don't use /auth/me here, because its 401 shows up as an error in the
browser console for every logged-out visitor.
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
  updateUser: (user: AuthUser) => void
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
      .session()
      .then(({ user }) => {
        setUser(user)
        setStatus(user ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        // Only a real failure now (server down, network error).
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

  // Used when the server hands back a changed version of you, for example
  // after you changed your display name. Everyone reading useAuth() sees it.
  function updateUser(updated: AuthUser) {
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout, updateUser }}>
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
