import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { isEmail } from 'validator'
import FormField from '../components/FormField'
import PrimaryButton from '../components/PrimaryButton'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'

type Errors = {
  email?: string
  password?: string
}

/*
  LoginPage

  1. User types email and password, submits.
  2. validate() checks first, client-side only. Invalid? Stop here,
     show errors, no request sent yet.
  3. Valid? Call authApi.login(), the server checks the real thing.
  4. Success: go to the page the user tried to open before (or /home).
  5. 401 from server: wrong email or password
  6. 400 with fieldErrors: same handling as RegisterPage
*/
function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function validate(): boolean {
    const next: Errors = {}

    if (!email) {
      next.email = 'Email is required.'
    } else if (!isEmail(email)) {
      // Matches backend's email check (same `validator` library).
      next.email = 'Enter a valid email address.'
    }

    if (!password) {
      next.password = 'Password is required.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      await login({ email, password })

      // If user opens page like /profile while logged out,
      // ProtectedRoute redirects to /login and attaches page to
      // navigation (location.state)
      // After login, sends user to that page. Not /home.
      const from = (location.state as { from?: { pathname: string } } | null)?.from
      navigate(from?.pathname ?? '/home', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Generic on purpose: see issue #20, don't reveal which field was wrong.
        setFormError('Incorrect email or password.')
        // e.g. password field missing or not a string. Same handling as RegisterPage.
      } else if (error instanceof ApiError && error.fieldErrors) {
        setErrors(error.fieldErrors)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 px-4"
    >
      <h1 className="font-barrio text-2xl text-(--color-primary-content)">Welcome back!</h1>

      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />

      {formError && (
        <p role="alert" className="text-sm text-error">
          {formError}
        </p>
      )}

      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log in'}
      </PrimaryButton>

      <p className="text-center text-sm text-muted">
        No account yet?{' '}
        <Link to="/register" className="text-(--color-primary-content) underline">
          Register
        </Link>
      </p>
    </form>
  )
}

export default LoginPage
