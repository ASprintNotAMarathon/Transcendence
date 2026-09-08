/*
  Api.ts: The ONLY place our frontend talks to the backend.

  Every other file just calls authApi.login(...) or authApi.me(), 
  no need to know about fetch, cookies, or errors.

  Three layers:
  1. The shapes of data (LAYER 1)
  2. request(), the one function every call goes through (LAYER 2)
  3. authApi, the functions the rest of the app calls (LAYER 3)
*/
 


/*
  LAYER 1: Shapes of data that go in / out:
            - RegisterInput: what we send to register
            - LoginInput: what we send to login
            - AuthUser: what the server sends back
        
        Source: according our Auth contract, decision 03
*/
export type AuthUser = {
  id: string
  email: string
  displayName: string 
  createdAt: string
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

// Thrown when a request fails. Wraps response from server.
// Shape of response is confirmed with Kimia: 400/409 return
// { errors: { fieldName: "message" } }, 401 (login) is a single
// form-level message instead, see LoginPage.
export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string>

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/*
  LAYER 2   request(): function that for each call does the same:
            send to /api, send cookies with it, checks if succeed, if not, send ApiError.
*/
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    // Goes through the Vite proxy, so this is same origin. No CORS needed.
    // Cookie's Secure flag is off in dev, on in production.
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
    throw new ApiError(response.status, message, body?.errors)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

/*
  LAYER 3   authApi: contains 4 simple functions: register, login, logout, me.
            Each calls request() with the right path + data.
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
