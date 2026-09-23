import { ApiError, type AuthUser, type LoginInput, type RegisterInput } from './api'


/*
  TEMP: delete this file once #20 (the real backend) is merged and stable
  on main. Not meant to stick around like the mock chat client.

  Mock authApi, same shape as the real one in api.ts. So we can test
  the auth screens before #20 is merged.

  Toggle with VITE_MOCK_AUTH=true in .env, see .env.example.

  Triggers, to test specific responses:
  - register with email "taken@example.com"  -> 409, field error on email
  - login with any password except "password123"  -> 401, wrong credentials
  - anything else on register/login -> succeeds
  - me() returns whoever last logged in or registered, until you log out.
    There's no real cookie, so the mock keeps that user in localStorage
    instead, and a refresh keeps you logged in like the real session will.
*/

const STORAGE_KEY = 'mockAuthUser'

// Storage can be missing or blocked (private windows), so failing just means
// the mock forgets you, same as a lost cookie.
function remember(user: AuthUser): AuthUser {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } catch {
    // ignore
  }
  return user
}

function forget(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function recall(): AuthUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as AuthUser) : null
  } catch {
    return null
  }
}

export const mockAuthApi = {
  async register(input: RegisterInput): Promise<AuthUser> {
    if (input.email === 'taken@example.com') {
      throw new ApiError(409, 'Conflict', { email: 'That email is already registered' })
    }
    return remember({
      id: 'mock-id',
      email: input.email,
      displayName: input.displayName,
      createdAt: new Date().toISOString(),
    })
  },

  async login(input: LoginInput): Promise<AuthUser> {
    if (input.password !== 'password123') {
      throw new ApiError(401, 'Incorrect email or password.')
    }
    return remember({
      id: 'mock-id',
      email: input.email,
      displayName: 'mock-user',
      createdAt: new Date().toISOString(),
    })
  },

  async logout(): Promise<void> {
    forget()
  },

  async me(): Promise<AuthUser> {
    const user = recall()
    if (!user) throw new ApiError(401, 'Unauthorized')
    return user
  },
}
