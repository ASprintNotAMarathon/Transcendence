import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

type Errors = {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})

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

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return

    // Posting to the API happens once issue #? (auth) lands. For now this
    // only confirms the form validates correctly.
    console.log('login submit', { email, password })
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 px-4"
    >
      <h1 className="text-2xl font-bold text-white">Log in</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-slate-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-slate-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
      </div>

      <button
        type="submit"
        className="rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
      >
        Log in
      </button>

      <p className="text-center text-sm text-slate-400">
        No account yet?{' '}
        <Link to="/register" className="text-white underline">
          Register
        </Link>
      </p>
    </form>
  )
}

export default LoginPage
