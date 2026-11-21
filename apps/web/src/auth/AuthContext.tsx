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

Session end: /auth/session also says how many seconds the session has
left (expiresIn). We set a timer and log out here, in the app, a little
before that moment. Without it the app would still think you're logged in
after 24h, and the next click or socket reconnect would get a 401.
*/

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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

// Log out this many seconds before the server would refuse the token, so a
// request already on its way still arrives in time.
const SAFETY_MARGIN_S = 30

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  // When we log out by ourselves (ms timestamp), and the timer that does it.
  const deadline = useRef<number | null>(null)
  const timer = useRef<number | undefined>(undefined)

  // Logged out in the app only, no request: the session is already over, and
  // asking the server would get exactly the 401 we are avoiding.
  const endSession = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    deadline.current = null
    setUser(null)
    setStatus('anonymous')
  }, [])

  // Takes the answer of /auth/session: sets who we are and starts the timer.
  const applySession = useCallback(
    ({ user, expiresIn }: { user: AuthUser | null; expiresIn?: number }) => {
      const msLeft = ((expiresIn ?? 0) - SAFETY_MARGIN_S) * 1000
      if (!user || msLeft <= 0) {
        endSession()
        return
      }
      window.clearTimeout(timer.current)
      deadline.current = Date.now() + msLeft
      timer.current = window.setTimeout(endSession, msLeft)
      setUser(user)
      setStatus('authenticated')
    },
    [endSession],
  )

  // According to our auth contract: JWT lifetime is 24h. Logout only clears
  // the browser's cookie, it can't cancel the token, a copy elsewhere stays
  // valid. We are aware of this 'limitation'.
  useEffect(() => {
    authApi
      .session()
      .then(applySession)
      // A failure here is a real one (server down, network error).
      .catch(endSession)
  }, [applySession, endSession])

  // A sleeping laptop pauses timers, so one can fire late. When the tab comes
  // back, check the deadline ourselves before anything else talks to the server.
  useEffect(() => {
    function checkDeadline() {
      if (deadline.current !== null && Date.now() >= deadline.current) endSession()
    }
    document.addEventListener('visibilitychange', checkDeadline)
    window.addEventListener('focus', checkDeadline)
    return () => {
      document.removeEventListener('visibilitychange', checkDeadline)
      window.removeEventListener('focus', checkDeadline)
      window.clearTimeout(timer.current)
    }
  }, [endSession])

  // Login and register start a new 24h session, so we ask /auth/session
  // again: the same path as startup, and the timer restarts.
  // If the server said yes but /auth/session says nobody, the browser did not
  // keep the cookie: throw, so the form shows "Something went wrong" instead
  // of silently sending you back to /login.
  async function startSession() {
    const session = await authApi.session()
    applySession(session)
    if (!session.user) throw new Error('Logged in, but the session cookie was not kept.')
  }

  async function login(input: LoginInput) {
    await authApi.login(input)
    await startSession()
  }

  async function register(input: RegisterInput) {
    await authApi.register(input)
    await startSession()
  }

  async function logout() {
    await authApi.logout()
    endSession()
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
