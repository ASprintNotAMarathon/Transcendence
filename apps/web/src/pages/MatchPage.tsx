/*
 * MatchPage is the screen behind /match/:matchId.
 *
 * It turns a match.state payload into a board.
 * `payload.state` is typed unknown on purpose (see README, "Match events"),
 * so the page never reads it directly: it goes through gomoku.deserialize,
 * which validates it and hands back a typed GomokuState, or throws.
 *
 * For now the payload is a local fixture.
 * TODO(#24): take it from the socket's match.state reply to match.join instead.
 */

import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { gomoku } from '@transcendence/shared'
import type { GomokuState } from '@transcendence/shared'
import ErrorState from '../components/states/ErrorState'
import GomokuBoard from '../match/GomokuBoard'
import type { StoneStyle } from '../match/stones'
import MatchPlayers from '../match/MatchPlayers'
import { fixtureMatchState } from '../match/fixture'

// A deserialize failure means the server sent a board this client cannot read.
// That is a bug to report, not something to draw around,
// so it gets an error screen rather than an empty board.
function readBoard(game: string, state: unknown): GomokuState | null {
  if (game !== gomoku.name) return null
  try {
    return gomoku.deserialize(state)
  } catch {
    return null
  }
}

function MatchPage() {
  const payload = fixtureMatchState
  const board = useMemo(() => readBoard(payload.game, payload.state), [payload])

  // TEMP: switch between the two stone styles so the team can pick one.
  // Kept in the URL (?stones=red) so either look can be shared as a link.
  // Delete the switch and the StoneStyle option once we have decided.
  const [searchParams, setSearchParams] = useSearchParams()
  const stones: StoneStyle = searchParams.get('stones') === 'red' ? 'red' : 'classic'

  function toggleStones() {
    setSearchParams(stones === 'red' ? {} : { stones: 'red' }, { replace: true })
  }

  if (board === null) {
    return <ErrorState message="This match could not be displayed." />
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
        Black stones
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={stones === 'red'}
          onChange={toggleStones}
        />
        Red stones on a black board
      </label>
      {/*
        Three columns so the board stays in the exact centre of the page:
        an empty one on the left balances the player panel on the right.
        Below xl there isn't room beside the board, so the panel goes under it.
      */}
      <div className="grid w-full justify-items-center gap-8 xl:grid-cols-[1fr_32rem_1fr] xl:items-start">
        <div className="flex w-full max-w-[32rem] justify-center xl:col-start-2">
          <GomokuBoard state={board} stones={stones} />
        </div>
        <div className="w-full max-w-[32rem] xl:w-56 xl:justify-self-start">
          <MatchPlayers
            players={payload.players}
            turn={payload.turn}
            outcome={payload.outcome}
            stones={stones}
          />
        </div>
      </div>
    </div>
  )
}

export default MatchPage
