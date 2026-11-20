import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { isEmail } from 'validator'
import PrimaryButton from '../components/PrimaryButton'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'
import ErrorText from '../components/ErrorText'
import FormField from '../components/FormField'

type Errors = {
  email?: string
  password?: string
}

/*
  Wrong email or wrong password return a generic 401 from server.
  On purpose: see issue #20, requiring: without revealing which field was wrong.
*/
const INVALID_CREDENTIALS_MESSAGE = 'Incorrect email or password.'


/*
  Login Page 
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
      // Same isEmail() from `validator` as RegisterPage.tsx uses, see the
      // comment there for why (matches class-validator's @IsEmail()).
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
      className="mx-auto flex flex-1 w-full max-w-sm flex-col justify-center gap-4 px-4"
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

      {formError && <ErrorText live>{formError}</ErrorText>}

      <PrimaryButton block type="submit" disabled={submitting}>
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
