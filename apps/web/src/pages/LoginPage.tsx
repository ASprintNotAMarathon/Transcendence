import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import PrimaryButton from '../components/PrimaryButton'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'

type Errors = {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/*
  Wrong email or password come back as a plain 401 from the
  server, on purpose (see issue #20: "without revealing which field was
  wrong"). So this is one error message for both cases, it's not
  attached to a specific field.
*/
const INVALID_CREDENTIALS_MESSAGE = 'Incorrect email or password.'

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
    } else if (!EMAIL_PATTERN.test(email)) {
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

      // If ProtectedRoute sent the user here, go back to where they were
      // headed. Otherwise the lobby is the default first stop.
      const from = (location.state as { from?: { pathname: string } } | null)?.from
      navigate(from?.pathname ?? '/home', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError(INVALID_CREDENTIALS_MESSAGE)
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

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-(--color-primary-content)"
        />
        {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-(--color-primary-content)"
        />
        {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-400">
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
