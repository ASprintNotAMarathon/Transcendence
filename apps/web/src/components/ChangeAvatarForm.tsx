import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { AuthUser } from '../lib/api'
import { AVATAR_HINT, checkAvatarFile } from '../lib/avatarFile'
import { saveAvatar } from '../lib/fakeProfiles'

const buttonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'

type Props = {
  user: AuthUser
  onDone: () => void
}

export default function ChangeAvatarForm({ user, onDone }: Props) {
  const { updateUser } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null
    if (!chosen) {
      setFile(null)
      setError(null)
      return
    }
    const problem = checkAvatarFile(chosen)
    setError(problem)
    setFile(problem ? null : chosen)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError('Please choose a file first.')
      return
    }
    setSaving(true)
    try {
      const updated = await saveAvatar(user, file)
      updateUser(updated)
      onDone()
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
      <label htmlFor="avatar" className="text-muted text-sm">
        {AVATAR_HINT}
      </label>
      <input
        id="avatar"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        aria-describedby={error ? 'avatar-error' : undefined}
        className="file-input file-input-sm w-full"
      />
      {error && (
        <p id="avatar-error" role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={buttonClass}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onDone} disabled={saving} className={buttonClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}