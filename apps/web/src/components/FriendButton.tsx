import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api'
import { friendsApi, type Friendship } from '../lib/friends'

/*
  FriendButton. The friend button on someone else's profile.

    none       [ Add friend ]
    requested  Request sent  Cancel request
    incoming   [ Accept ]  Decline
    friends    Friends  Remove friend
    self       nothing (it is your own profile)
*/

const buttonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'
const statusClass =
  'inline-flex h-8 items-center rounded-full border-2 border-(--color-base-300) px-3 text-sm text-muted'
const quietLinkClass =
  'text-sm text-muted underline hover:text-(--color-base-content) disabled:no-underline'

type FriendButtonProps = {
  userId: string
}

function FriendButton({ userId }: FriendButtonProps) {
  // null = we do not know yet
  const [friendship, setFriendship] = useState<Friendship | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If you leave the page before the answer arrives, ignore the answer.
    let ignore = false
    setFriendship(null)
    setError(null)
    friendsApi
      .statusWith(userId)
      .then((value) => {
        if (!ignore) setFriendship(value)
      })
      .catch(() => {
        if (!ignore) setError('We could not load the friend status.')
      })
    return () => {
      ignore = true
    }
  }, [userId])

  // Runs one action. If it works, the button changes to the next state.
  // next = null means: ask the server what the status is now.
  async function run(action: () => Promise<void>, next: Friendship | null) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setFriendship(next ?? (await friendsApi.statusWith(userId)))
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? 'There is already a request or friendship with this player.'
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (friendship === null) {
    return error ? (
      <p role="alert" className="text-sm text-red-400">
        {error}
      </p>
    ) : null
  }

  if (friendship === 'self') return null

  return (
    <>
      {friendship === 'none' && (
        <button
          type="button"
          disabled={busy}
          className={buttonClass}
          onClick={() => run(() => friendsApi.send(userId), null)}
        >
          Add friend
        </button>
      )}

      {friendship === 'requested' && (
        <>
          <span className={statusClass}>Request sent</span>
          <button
            type="button"
            disabled={busy}
            className={quietLinkClass}
            onClick={() => run(() => friendsApi.remove(userId), 'none')}
          >
            Cancel request
          </button>
        </>
      )}

      {friendship === 'incoming' && (
        <>
          <button
            type="button"
            disabled={busy}
            className={buttonClass}
            onClick={() => run(() => friendsApi.acceptFrom(userId), 'friends')}
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            className={quietLinkClass}
            onClick={() => run(() => friendsApi.declineFrom(userId), 'none')}
          >
            Decline
          </button>
        </>
      )}

      {friendship === 'friends' && (
        <>
          <span className={statusClass}>Friends</span>
          <button
            type="button"
            disabled={busy}
            className={quietLinkClass}
            onClick={() => run(() => friendsApi.remove(userId), 'none')}
          >
            Remove friend
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </>
  )
}

export default FriendButton