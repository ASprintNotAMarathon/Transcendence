/*
 * MatchPlayers sits beside the board: both players, their stone,
 * and whose turn it is (or who won, once the match is over).
 *
 * Like GomokuBoard it only draws what it is given.
 * `turn` means nothing once `outcome` is set, so it is only read while the match runs.
 */

import type { GameOutcome, MatchStatePayload, PlayerIndex } from '@transcendence/shared'
import { stoneFill, stoneStroke } from './stones'
import type { StoneStyle } from './stones'

type MatchPlayersProps = {
  players: MatchStatePayload['players']
  turn: PlayerIndex
  outcome: GameOutcome | null
  stones: StoneStyle
}

function status(players: MatchPlayersProps['players'], turn: PlayerIndex, outcome: GameOutcome | null): string {
  if (outcome === null) return `${players[turn].displayName}'s turn`
  if (outcome.kind === 'draw') return 'Draw'
  return `${players[outcome.player].displayName} wins`
}

function MatchPlayers({ players, turn, outcome, stones }: MatchPlayersProps) {
  // Highlighted: the player to move, or the winner. Nobody, on a draw.
  const highlighted = outcome === null ? turn : outcome.kind === 'win' ? outcome.player : null

  return (
    <section aria-label="Players" className="flex w-full flex-col gap-3">
      <p aria-live="polite" className="font-barrio text-2xl text-(--color-primary-content)">
        {status(players, turn, outcome)}
      </p>

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
                <circle
                  r={7}
                  strokeWidth={1}
                  style={{ fill: stoneFill(seat, stones), stroke: stoneStroke(seat, stones) }}
                />
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
