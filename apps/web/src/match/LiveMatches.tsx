import { useEffect, useState } from 'react'
import type { LiveMatch } from '@transcendence/shared'
import { useAuth } from '../auth/AuthContext'
import ErrorState from '../components/states/ErrorState'
import LoadingState from '../components/states/LoadingState'
import { matchApi } from '../lib/api'
import LiveMatchRow from './LiveMatchRow'

type Lobby =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; current: LiveMatch | null; live: LiveMatch[] }

const headingClass = 'text-xs font-semibold uppercase tracking-widest text-muted'

function LiveMatches() {
  const { user } = useAuth()
  const [lobby, setLobby] = useState<Lobby>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    Promise.all([matchApi.current(), matchApi.live()])
      .then(([current, live]) => {
        if (!cancelled) setLobby({ status: 'loaded', current, live })
      })
      .catch(() => {
        if (!cancelled) setLobby({ status: 'failed' })
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = () => {
    setLobby({ status: 'loading' })
    setAttempt((count) => count + 1)
  }

  if (lobby.status === 'loading') {
    return <LoadingState message="Loading the lobby…" />
  }

  if (lobby.status === 'failed') {
    return <ErrorState message="The lobby could not be loaded." onRetry={retry} />
  }

  const { current, live } = lobby
  const others = live.filter((match) => match.matchId !== current?.matchId)

  return (
    <div className="flex flex-col gap-8">
      {current !== null && (
        <section aria-labelledby="lobby-your-match" className="flex flex-col gap-3">
          <h2 id="lobby-your-match" className={headingClass}>
            Your match
          </h2>
          <LiveMatchRow match={current} userId={user?.id} highlighted />
        </section>
      )}

      <section aria-labelledby="lobby-live-matches" className="flex flex-col gap-3">
        <h2 id="lobby-live-matches" className={headingClass}>
          Live matches
        </h2>
        {others.length === 0 ? (
          <p className="text-muted">No other games are being played right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {others.map((match) => (
              <li key={match.matchId}>
                <LiveMatchRow match={match} userId={user?.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default LiveMatches
