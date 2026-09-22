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
  - me() always fails (401) -> mock mode always starts anonymous, a
    refresh logs you out again, there's no real cookie to persist you
*/

export const mockAuthApi = {
  async register(input: RegisterInput): Promise<AuthUser> {
    if (input.email === 'taken@example.com') {
      throw new ApiError(409, 'Conflict', { email: 'That email is already registered' })
    }
    return {
      id: 'mock-id',
      email: input.email,
      displayName: input.displayName,
      createdAt: new Date().toISOString(),
    }
  },

  async login(input: LoginInput): Promise<AuthUser> {
    if (input.password !== 'password123') {
      throw new ApiError(401, 'Incorrect email or password.')
    }
    return {
      id: 'mock-id',
      email: input.email,
      displayName: 'mock-user',
      createdAt: new Date().toISOString(),
    }
  },

  async logout(): Promise<void> {},

  async me(): Promise<AuthUser> {
    throw new ApiError(401, 'Unauthorized')
  },
}
