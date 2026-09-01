import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import PrimaryButton from '../components/PrimaryButton'

type Errors = {
  displayName?: string
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  function validate(): boolean {
    const next: Errors = {}

    if (!displayName) {
      next.displayName = 'Display name is required.'
    }

    if (!email) {
      next.email = 'Email is required.'
    } else if (!EMAIL_PATTERN.test(email)) {
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return

    // Posting to the API happens once issue #? (auth) lands. For now this
    // only confirms the form validates correctly.
    console.log('register submit', { displayName, email, password })
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 px-4"
    >
      <h1 className="font-barrio text-2xl font-bold text-white">Create an account</h1>

      <div className="flex flex-col gap-1">

        <input
          id="displayName"
          type="text"
          autoComplete="name"
          placeholder="Choose a nickname"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        {errors.displayName && <p className="text-sm text-red-400">{errors.displayName}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
      </div>

      <PrimaryButton type="submit">Get started</PrimaryButton>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-white underline">
          Log in
        </Link>
      </p>
    </form>
  )
}

export default RegisterPage
