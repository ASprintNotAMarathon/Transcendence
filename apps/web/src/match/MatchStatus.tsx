import type { GameOutcome, MatchEndReason, MatchStatePayload, PlayerIndex } from '@transcendence/shared'

type MatchStatusProps = {
  players: MatchStatePayload['players']
  seat: PlayerIndex | null
  turn: PlayerIndex
  outcome: GameOutcome | null
  endReason: MatchEndReason | null
}

function headline({ players, seat, turn, outcome }: MatchStatusProps): string {
  if (outcome === null) return `${players[turn].displayName}'s turn`
  if (outcome.kind === 'draw') return 'Draw'
  if (seat === null) return `${players[outcome.player].displayName} wins`
  return outcome.player === seat ? 'You won' : 'You lost'
}

function reason({ players, seat, outcome, endReason }: MatchStatusProps): string | null {
  if (outcome === null) return null
  if (outcome.kind === 'draw') return 'The board is full'

  const name = (player: PlayerIndex) => (player === seat ? 'You' : players[player].displayName)
  const winner = outcome.player
  const loser = winner === 0 ? 1 : 0

  if (endReason === 'resigned') return `${name(loser)} resigned`
  if (endReason === 'abandoned') return `${name(loser)} left the match`
  return `${name(winner)} got five in a row`
}

function MatchStatus(props: MatchStatusProps) {
  const detail = reason(props)
  const watching = props.seat === null

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      {watching && (
        <span className="rounded-full border border-(--color-secondary) px-3 py-0.5 text-xs font-semibold uppercase tracking-widest text-(--color-secondary)">
          Watching
        </span>
      )}
      <div aria-live="polite" className="flex flex-wrap items-baseline gap-x-3">
        <p className="font-barrio text-2xl text-(--color-primary-content)">{headline(props)}</p>
        {detail !== null && <p className="text-sm text-muted">{detail}</p>}
      </div>
    </div>
  )
}

export default MatchStatus
