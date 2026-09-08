import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { isEmail } from 'validator'
import FormField from '../components/FormField'
import PrimaryButton from '../components/PrimaryButton'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'

type Errors = {
  displayName?: string
  email?: string
  password?: string
}

// Per Kimia's Auth contract (decision 02, proposal): password minimum 8
// characters, displayName 3-20 characters, letters/digits/underscore/hyphen only.
const MIN_PASSWORD_LENGTH = 8
const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/

// Where someone creates a new account for the first time.
function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  function validate(): boolean {
    const next: Errors = {}

    if (!displayName) {
      next.displayName = 'Display name is required.'
    } else if (!DISPLAY_NAME_PATTERN.test(displayName)) {
      next.displayName = 'Use 3 to 20 letters, numbers, underscores or hyphens.'
    }

    if (!email) {
      next.email = 'Email is required.'
    } else if (!isEmail(email)) {
      // `validator`'s isEmail(), same library NestJS's class-validator
      // uses under the hood for @IsEmail(). Kimia's auth contract also
      // lowercases the email before storing it, so what /me and friends
      // return may not match the casing someone typed here, that's expected.
      next.email = 'Enter a valid email address.'
    }

    if (!password) {
      next.password = 'Password is required.'
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      await register({ displayName, email, password })
      navigate('/home', { replace: true })
    } catch (error) {
      // Confirmed with Kimia: 400 and 409 both return
      // { errors: { fieldName: "message" } }, handled the same way here.
      if (error instanceof ApiError && error.fieldErrors) {
        setErrors(error.fieldErrors)
      } else {
        setErrors({ email: 'Something went wrong. Please try again.' })
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
      <h1 className="font-barrio text-2xl font-bold text-(--color-primary-content)">Create your account</h1>

      <FormField
        id="displayName"
        label="Display name"
        type="text"
        autoComplete="name"
        placeholder="Choose a nickname"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        error={errors.displayName}
      />

      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="Choose a password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />

      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Get started'}
      </PrimaryButton>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-(--color-primary-content) underline">
          Log in
        </Link>
      </p>
    </form>
  )
}

export default RegisterPage
