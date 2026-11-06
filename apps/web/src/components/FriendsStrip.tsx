import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Avatar from './Avatar'
import { friendsApi, type Friend } from '../lib/friends'
import { useOnlineStatus } from '../socket/useOnlineStatus'
import Card from './Card'

/*
  FriendsStrip. A small card for the home page.

    FRIENDS  [1 request]
    ( c )o   ( d )   ( + )
    charlie  dana    See all

  Shows the first few friends with their online dot. The full list,
  and answering requests, lives on /friends.
*/

const MAX_SHOWN = 5

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; friends: Friend[]; requestCount: number }
  | { status: 'error' }

function FriendsStrip() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const onlineIds = useOnlineStatus()

  useEffect(() => {
    // If you leave the page before the answer arrives, ignore the answer.
    let ignore = false
    Promise.all([friendsApi.list(), friendsApi.requests()])
      .then(([friends, requests]) => {
        if (!ignore) {
          setState({ status: 'ready', friends, requestCount: requests.incoming.length })
        }
      })
      .catch(() => {
        if (!ignore) setState({ status: 'error' })
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <Card as ="section">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm uppercase tracking-wide text-muted">Friends</h2>
        {state.status === 'ready' && state.requestCount > 0 && (
          <Link
            to="/friends"
            className="rounded-full bg-(--color-primary) px-2 text-xs text-(--color-primary-content)"
          >
            {state.requestCount} {state.requestCount === 1 ? 'request' : 'requests'}
          </Link>
        )}
      </div>

      {state.status === 'loading' && <p className="text-sm text-muted">Loading…</p>}
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-400">
          We could not load your friends.
        </p>
      )}

      {state.status === 'ready' && state.friends.length === 0 && (
        <p className="text-sm text-muted">
          No friends yet. Open a player's profile and choose Add friend.
        </p>
      )}

      {state.status === 'ready' && state.friends.length > 0 && (
        <ul className="flex flex-wrap gap-4">
          {state.friends.slice(0, MAX_SHOWN).map((friend) => (
            <li key={friend.id}>
              <Link
                to={`/profile/${encodeURIComponent(friend.id)}`}
                className="flex w-16 flex-col items-center gap-1 text-xs text-muted hover:text-(--color-base-content)"
              >
                <Avatar
                  displayName={friend.displayName}
                  avatarUrl={friend.avatarUrl}
                  size="md"
                  online={onlineIds ? onlineIds.has(friend.id) : friend.online}
                />
                <span className="w-full truncate text-center">{friend.displayName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {state.status === 'ready' && (
        <Link to="/friends" className="mt-3 inline-block text-sm text-muted underline">
          See all friends
        </Link>
      )}
    </Card>
  )
}

export default FriendsStrip