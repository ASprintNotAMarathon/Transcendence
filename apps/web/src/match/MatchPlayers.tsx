import type { GameOutcome, MatchStatePayload, PlayerIndex } from '@transcendence/shared'
import { stoneFill } from './stones'
import PlayerLink from '../components/PlayerLink'
import Card from '../components/Card'


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
          <Card
            as="li"
            key={player.userId}
            size="sm"
            highlighted={active}
            className={`flex min-w-0 items-center gap-2 transition-colors xl:gap-3 ${
              active ? 'text-(--color-primary-content)' : 'text-muted'
            }`}
          >
            <svg viewBox="-8 -8 16 16" className="size-4 shrink-0 xl:size-5" aria-hidden="true">
              <circle r={7} style={{ fill: stoneFill(seat) }} />
            </svg>
            <PlayerLink userId={player.userId} displayName={player.displayName} />
          </Card>
        )
      })}
    </ul>
  )
}

export default MatchPlayers
