import type { GameOutcome, MatchStatePayload, PlayerIndex } from '@transcendence/shared'
import { stoneFill } from './stones'

type MatchPlayersProps = {
  players: MatchStatePayload['players']
  turn: PlayerIndex
  outcome: GameOutcome | null
}

function MatchPlayers({ players, turn, outcome }: MatchPlayersProps) {
  const highlighted = outcome === null ? turn : outcome.kind === 'win' ? outcome.player : null

  return (
    <ul aria-label="Players" className="grid grid-cols-2 gap-2 xl:grid-cols-1">
      {players.map((player, index) => {
        const seat = index as PlayerIndex
        const active = highlighted === seat
        return (
          <li
            key={player.userId}
            className={`flex min-w-0 items-center gap-2 rounded-box border-2 px-3 py-2 transition-colors xl:gap-3 xl:px-4 xl:py-3 ${
              active
                ? 'border-(--color-primary) bg-(--color-base-100) text-(--color-primary-content)'
                : 'border-(--color-board-line) text-muted xl:border-transparent'
            }`}
          >
            <svg viewBox="-8 -8 16 16" className="size-4 shrink-0 xl:size-5" aria-hidden="true">
              <circle r={7} style={{ fill: stoneFill(seat) }} />
            </svg>
            <span className="truncate">{player.displayName}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default MatchPlayers
