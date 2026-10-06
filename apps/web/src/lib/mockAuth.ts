import { ApiError, type AuthUser, type LoginInput, type RegisterInput } from './api'


// TEMP: delete this file once #20 (the real backend) is merged and stable on main.

const STORAGE_KEY = 'mockAuthUser'

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
