/* 

Api.ts - The bigger picture

This is the only place our frontend knows how to talk with our backend.
It's the border between the app and the server. Every other file
(LoginPage, RegisterPage, AuthContext) just calls authApi.login(...) or
authApi.me(), without needing to know about fetch, cookies, or errors.

Three layers:
1. One function every call goes through: request() (LAYER 1)
2. Four functions in authApi the rest of the app actually calls (LAYER 2)
3. The shapes of data that go in and out (LAYER 3)

*/

/*
	LAYER 3: Shapes of data that go in and out:
	- RegisterInput:	frontend input we send to server (raw input)
	- LoginInput: 		frontend input we send to server (raw input) 
	- AuthUser:			what server sends back (shaped as id, email, displayName)

	Two different ways to get AuthUser data:
	- register: new input → new row in database → give back AuthUser 
	- login: input to check → search in database → give back AuthUser 

	NOTE! As soon #20 Kimia's PR #20 is open: check what her 
	AuthController gives back exactly and adapt to it.
*/
export type AuthUser = {
  id: string
  email: string
  displayName: string
}

export type RegisterInput = {
  email: string
  displayName: string
  password: string
}

export type LoginInput = {
  email: string
  password: string
}

/*
	LAYER 2: contains four simple functions in authApi:
	register, login, logout, me. Each of them call request() 
	with the right path + data
*/
export const authApi = {
  register(input: RegisterInput) {
    return request<AuthUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  login(input: LoginInput) {
    return request<AuthUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  logout() {
    return request<void>('/auth/logout', { method: 'POST' })
  },

  me() {
    return request<AuthUser>('/auth/me')
  },
}

/* 
	LAYER 1:  
	request(): one function that for each call does the same:
	send to /api, send cookies with it, checks if it succeed, if not, send an ApiError.
*/ 
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body?.message ?? `Request failed with status ${response.status}`
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
