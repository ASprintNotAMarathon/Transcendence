import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api'
import { friendsApi, type Friendship } from '../lib/friends'
import { useFriendsChanged } from '../socket/useFriendsChanged'
import ErrorText from './ErrorText'
import QuietButton from './QuietButton'
import Icon from './Icon'
import PrimaryButton from './PrimaryButton'

/*
  FriendButton. The friend button on someone else's profile.

    none       [ Add friend ]
    requested  Request sent  Cancel request
    incoming   [ Accept ]  Decline
    friends    Friends  Remove friend
    self       nothing (it is your own profile)
*/

const statusClass =
  'inline-flex h-8 items-center rounded-full border-2 border-(--color-base-300) px-3 text-sm text-muted'

type FriendButtonProps = {
  userId: string
}

function FriendButton({ userId }: FriendButtonProps) {
  // null = we do not know yet
  const [friendship, setFriendship] = useState<Friendship | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const friendsChanged = useFriendsChanged()

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

  useEffect(() => {
    if (friendsChanged === 0) return
    let ignore = false
    friendsApi
      .statusWith(userId)
      .then((value) => {
        if (!ignore) setFriendship(value)
      })
      .catch(() => undefined)
    return () => {
      ignore = true
    }
  }, [userId, friendsChanged])

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
      <ErrorText live>{error}</ErrorText>
    ) : null
  }

  if (friendship === 'self') return null

  return (
    <>
      {friendship === 'none' && (
        <PrimaryButton
          size="sm"
          disabled={busy}
          onClick={() => run(() => friendsApi.send(userId), null)}
        >
          <Icon name="addFriend" />
          Add friend
        </PrimaryButton>
      )}

      {friendship === 'requested' && (
        <>
          <span className={statusClass}>Request sent</span>
          <QuietButton disabled={busy} onClick={() => run(() => friendsApi.remove(userId), 'none')}>
            Cancel request
          </QuietButton>
        </>
      )}

      {friendship === 'incoming' && (
        <>
          <PrimaryButton
            size="sm"
            disabled={busy}
            onClick={() => run(() => friendsApi.acceptFrom(userId), 'friends')}
          >
            Accept
          </PrimaryButton>
          <QuietButton disabled={busy} onClick={() => run(() => friendsApi.declineFrom(userId), 'none')}>
            Decline
          </QuietButton>
        </>
      )}

      {friendship === 'friends' && (
        <>
          <span className={statusClass}>Friends</span>
          <QuietButton disabled={busy} onClick={() => run(() => friendsApi.remove(userId), 'none')}>
            Remove friend
          </QuietButton>
        </>
      )}

      {error && (
        <ErrorText live>{error}</ErrorText>
      )}
    </>
  )
}

export default FriendButton