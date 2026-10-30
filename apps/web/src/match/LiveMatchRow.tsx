import { Link } from 'react-router'
import type { LiveMatch, MatchPlayer, PlayerIndex } from '@transcendence/shared'
import { stoneFill } from './stones'

type LiveMatchRowProps = {
  match: LiveMatch
  userId: string | undefined
  highlighted?: boolean
}

const buttonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'

function movesLabel(moveNumber: number): string {
  if (moveNumber === 0) return 'No moves yet'
  if (moveNumber === 1) return '1 move'
  return `${moveNumber} moves`
}

function turnLabel(match: LiveMatch, seat: PlayerIndex | null): string {
  if (seat === match.turn) return 'Your turn'
  return `${match.players[match.turn].displayName}'s turn`
}

function Player({ player, seat }: { player: MatchPlayer; seat: PlayerIndex }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <svg viewBox="-8 -8 16 16" className="size-4 shrink-0" aria-hidden="true">
        <circle r={7} style={{ fill: stoneFill(seat) }} />
      </svg>
      <span className="truncate">{player.displayName}</span>
    </span>
  )
}

function LiveMatchRow({ match, userId, highlighted = false }: LiveMatchRowProps) {
  const index = match.players.findIndex((player) => player.userId === userId)
  const seat = index === -1 ? null : (index as PlayerIndex)

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-box border-2 px-4 py-3 ${
        highlighted ? 'border-(--color-primary) bg-(--color-base-100)' : 'border-(--color-board-line)'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-(--color-primary-content)">
          <Player player={match.players[0]} seat={0} />
          <span className="text-sm text-muted">vs</span>
          <Player player={match.players[1]} seat={1} />
        </p>
        <p className="text-sm text-muted">
          {movesLabel(match.moveNumber)} · {turnLabel(match, seat)}
        </p>
      </div>
      <Link to={`/match/${match.matchId}`} className={`shrink-0 ${buttonClass}`}>
        {seat === null ? 'Watch' : 'Resume'}
      </Link>
    </div>
  )
}

export default LiveMatchRow
