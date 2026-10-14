import type { GameOutcome, MatchEndReason, MatchStatePayload, PlayerIndex } from '@transcendence/shared'
import { stoneFill } from './stones'

type MatchPlayersProps = {
  players: MatchStatePayload['players']
  seat: PlayerIndex | null
  turn: PlayerIndex
  outcome: GameOutcome | null
  endReason: MatchEndReason | null
}

function status({ players, seat, turn, outcome }: MatchPlayersProps): string {
  if (outcome === null) return `${players[turn].displayName}'s turn`
  if (outcome.kind === 'draw') return 'Draw'
  if (seat === null) return `${players[outcome.player].displayName} wins`
  return outcome.player === seat ? 'You won' : 'You lost'
}

function reason({ players, seat, outcome, endReason }: MatchPlayersProps): string | null {
  if (outcome === null || outcome.kind === 'draw') return null

  const loser = outcome.player === 0 ? 1 : 0
  const who = loser === seat ? 'You' : players[loser].displayName

  if (endReason === 'resigned') return `${who} resigned`
  if (endReason === 'abandoned') return `${who} left the match`
  return null
}

function MatchPlayers(props: MatchPlayersProps) {
  const { players, turn, outcome } = props
  const highlighted = outcome === null ? turn : outcome.kind === 'win' ? outcome.player : null
  const detail = reason(props)

  return (
    <section aria-label="Players" className="flex w-full flex-col gap-3">
      <div aria-live="polite">
        <p className="font-barrio text-2xl text-(--color-primary-content)">{status(props)}</p>
        {detail !== null && <p className="text-sm text-muted">{detail}</p>}
      </div>

      <ul className="flex flex-col gap-2">
        {players.map((player, index) => {
          const seat = index as PlayerIndex
          const active = highlighted === seat
          return (
            <li
              key={player.userId}
              className={`flex items-center gap-3 rounded-box border-2 px-4 py-3 transition-colors ${
                active
                  ? 'border-(--color-primary) bg-(--color-base-100) text-(--color-primary-content)'
                  : 'border-transparent text-muted'
              }`}
            >
              <svg viewBox="-8 -8 16 16" className="size-5 shrink-0" aria-hidden="true">
                <circle r={7} style={{ fill: stoneFill(seat) }} />
              </svg>
              <span className="truncate">{player.displayName}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default MatchPlayers
