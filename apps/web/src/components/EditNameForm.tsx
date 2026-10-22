import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError, type AuthUser } from '../lib/api'
import { DISPLAY_NAME_MESSAGE, DISPLAY_NAME_PATTERN } from '../lib/displayName'
import { saveDisplayName } from '../lib/fakeProfiles'
import FormField from './FormField'

/*
  EditNameForm. Replaces the buttons on your own profile while you edit.

  [ NoralieH          ]
  This name is already taken.   <- error, only when there is one
  [ Save ] [ Cancel ]
*/

type EditNameFormProps = {
  user: AuthUser
  onDone: () => void
}

const buttonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'

function EditNameForm({ user, onDone }: EditNameFormProps) {
  const { updateUser } = useAuth()
  const [name, setName] = useState(user.displayName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!DISPLAY_NAME_PATTERN.test(name)) {
      setError(DISPLAY_NAME_MESSAGE)
      return
    }
    if (name === user.displayName) {
      onDone() // nothing changed, so nothing to save
      return
    }

    setSaving(true)
    try {
      const updated = await saveDisplayName(user, name)
      updateUser(updated)
      onDone()
    } catch (caught) {
      if (caught instanceof ApiError && caught.fieldErrors?.displayName) {
        setError(caught.fieldErrors.displayName)
      } else {
        setError('Something went wrong. Please try again.')
      }
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-3">
      <FormField
        id="displayName"
        label="Display name"
        type="text"
        autoComplete="nickname"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error ?? undefined}
      />
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={buttonClass}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" disabled={saving} onClick={onDone} className={buttonClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default EditNameForm