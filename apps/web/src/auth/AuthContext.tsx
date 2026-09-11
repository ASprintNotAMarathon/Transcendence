/*
AuthContext.tsx - Holds two things: 

1. Userinfo + status (from current user)
2. The three functions to change that (login, register, logout) 

Every other file (LoginPage, RegisterPage, AppLayout, ProtectedRoute)
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
import { authApi, type AuthUser, type LoginInput, type RegisterInput } from '../lib/api'

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

  // Checks the session once, on startup. JWT lifetime is 24h, longer
  // than a play session, so expiry doesnt happen during demo
  // (decision 05 in Auth Contract).
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


/*  login, register and logout below all follow the same async/await
  pattern: send the request, wait for the response, then update state.

Why async: API calls are network requests, they take time and don't resolve
right away. So 'async` + `await` means.

Until then, the call returns a Promise (placeholder for value that isn't there yet).
Promise = object with 3 possible states:
- pending: waiting, no result yet
- fulfilled:  succeeded, value is in (e.g. user data)
- rejected: failed, error

await = wait until pending is over, then give the value (fulfilled)
or throw the error (rejected). Without await you get the Promise
object itself back, not the value inside it.

*/
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
    // Clears this browser's cookie only. Can't invalidate the token
    // itself, a copy elsewhere (another browser, another tab that
    // copied it) stays valid until it expires. Accepted trade-off,
    // see decision 05.
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
