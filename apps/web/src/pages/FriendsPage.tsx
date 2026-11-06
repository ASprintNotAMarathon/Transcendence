import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import Avatar from '../components/Avatar'
import ErrorState from '../components/states/ErrorState'
import LoadingState from '../components/states/LoadingState'
import { friendsApi, type Friend, type FriendRequests, type Person } from '../lib/friends'
import { useOnlineStatus } from '../socket/useOnlineStatus'
import Card from '../components/Card'

/*
  FriendsPage. /friends

    REQUESTS FOR YOU    ( d ) dana          [ Accept ]  Decline
    YOUR FRIENDS        ( c )o charlie      Remove friend
    SENT BY YOU         ( a ) alice         Cancel request

  The green dot only shows for friends who are online. Sections with
  nothing in them are left out, except your friends (it shows a hint).
*/

const buttonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'
const quietLinkClass =
    'text-sm text-muted underline hover:text-(--color-base-content) disabled:no-underline'

type LoadState =
    | { status: 'loading' }
    | { status: 'ready'; friends: Friend[]; requests: FriendRequests }
    | { status: 'error' }

async function fetchAll() {
    const [friends, requests] = await Promise.all([friendsApi.list(), friendsApi.requests()])
    return { friends, requests }
}

type RowProps = {
    person: Person
    online?: boolean
    children: ReactNode
}

// One person: avatar, name (links to their profile) and the actions on the right.
function Row({ person, online, children }: RowProps) {
    return (
        <Card as="li" size="sm" className="flex items-center gap-3">
            <Avatar displayName={person.displayName} avatarUrl={person.avatarUrl} size="md" online={online} />
            <Link
                to={`/profile/${encodeURIComponent(person.id)}`}
                className="min-w-0 flex-1 truncate font-semibold hover:underline"
            >
                {person.displayName}
            </Link>
            <div className="flex items-center gap-3">{children}</div>
        </Card>
    )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mt-8">
            <h2 className="mb-3 text-sm uppercase tracking-wide text-muted">{title}</h2>
            {children}
        </section>
    )
}

function FriendsPage() {
    const [state, setState] = useState<LoadState>({ status: 'loading' })
    const [attempt, setAttempt] = useState(0) // goes up by one on "Try again"
    const [busyId, setBusyId] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const onlineIds = useOnlineStatus()

    useEffect(() => {
        // If you leave the page before the answer arrives, ignore the answer.
        let ignore = false
        fetchAll()
            .then((data) => {
                if (!ignore) setState({ status: 'ready', ...data })
            })
            .catch(() => {
                if (!ignore) setState({ status: 'error' })
            })
        return () => {
            ignore = true
        }
    }, [attempt])

    function handleRetry() {
        setState({ status: 'loading' })
        setAttempt((current) => current + 1)
    }

    // Runs one action, then loads the lists again so the page shows the new situation.
    async function act(id: string, action: () => Promise<void>) {
        setBusyId(id)
        setActionError(null)
        try {
            await action()
            const data = await fetchAll()
            setState({ status: 'ready', ...data })
        } catch {
            setActionError('Something went wrong. Please try again.')
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="max-w-2xl">
            <h1 className="font-barrio text-3xl text-(--color-base-content)">Friends</h1>

            {state.status === 'loading' && <LoadingState />}
            {state.status === 'error' && <ErrorState onRetry={handleRetry} />}

            {state.status === 'ready' && (
                <>
                    {actionError && (
                        <p role="alert" className="mt-4 text-sm text-red-400">
                            {actionError}
                        </p>
                    )}

                    {state.requests.incoming.length > 0 && (
                        <Section title="Requests for you">
                            <ul className="flex flex-col gap-3">
                                {state.requests.incoming.map((request) => (
                                    <Row key={request.id} person={request.user}>
                                        <button
                                            type="button"
                                            disabled={busyId === request.id}
                                            className={buttonClass}
                                            onClick={() => act(request.id, () => friendsApi.accept(request.id))}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyId === request.id}
                                            className={quietLinkClass}
                                            onClick={() => act(request.id, () => friendsApi.decline(request.id))}
                                        >
                                            Decline
                                        </button>
                                    </Row>
                                ))}
                            </ul>
                        </Section>
                    )}

                    <Section title="Your friends">
                        {state.friends.length === 0 ? (
                            <p className="text-muted">
                                You have no friends yet. Open a player's profile and choose Add friend.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {state.friends.map((friend) => (
                                    <Row
                                        key={friend.id}
                                        person={friend}
                                        online={onlineIds ? onlineIds.has(friend.id) : friend.online}
                                    >
                                        <button
                                            type="button"
                                            disabled={busyId === friend.id}
                                            className={quietLinkClass}
                                            onClick={() => act(friend.id, () => friendsApi.remove(friend.id))}
                                        >
                                            Remove friend
                                        </button>
                                    </Row>
                                ))}
                            </ul>
                        )}
                    </Section>

                    {state.requests.outgoing.length > 0 && (
                        <Section title="Sent by you">
                            <ul className="flex flex-col gap-3">
                                {state.requests.outgoing.map((request) => (
                                    <Row key={request.id} person={request.user}>
                                        <button
                                            type="button"
                                            disabled={busyId === request.id}
                                            className={quietLinkClass}
                                            onClick={() => act(request.id, () => friendsApi.remove(request.user.id))}
                                        >
                                            Cancel request
                                        </button>
                                    </Row>
                                ))}
                            </ul>
                        </Section>
                    )}
                </>
            )}
        </div>
    )
}

export default FriendsPage