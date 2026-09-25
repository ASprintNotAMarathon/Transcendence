/*
 * MatchPage is the screen behind /match/:matchId.
 *
 * It asks the server for the match and draws what comes back.
 * The board is never built here:
 * match.state carries it,
 * gomoku.deserialize validates it,
 * and this page renders whatever that returns.
 *
 *   join ──────────────► match.state   the whole board, once
 *
 * `payload.state` is typed unknown on purpose (see README, "Match events"),
 * so the page never reads it directly.
 *
 * join() is a standing request rather than a one-off send,
 * so a dropped connection repairs itself: the socket asks again on reconnect
 * and a fresh match.state replaces whatever this tab was holding.
 *
 * TODO(#25): nothing here listens for match.moved yet,
 * so a move played elsewhere only shows up on a reconnect. Next step.
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { gomoku } from '@transcendence/shared'
import type {
  GameOutcome,
  GomokuState,
  MatchPlayer,
  MatchStatePayload,
  PlayerIndex,
} from '@transcendence/shared'
import ErrorState from '../components/states/ErrorState'
import LoadingState from '../components/states/LoadingState'
import { joinMatch, leaveMatch } from '../lib/protocol'
import GomokuBoard from '../match/GomokuBoard'
import type { StoneStyle } from '../match/stones'
import MatchPlayers from '../match/MatchPlayers'
import { useSocket } from '../socket/context'

/*
 * What this page is showing right now.
 *
 * Not the payload the server sent: a payload is one message, while this is the
 * running picture that later messages update. match.state replaces the whole
 * view, and the next step, match.moved, will carry one move rather than a
 * board, so it needs something to apply that move onto.
 */
interface MatchView {
  readonly matchId: string
  readonly players: readonly [MatchPlayer, MatchPlayer]
  readonly turn: PlayerIndex
  readonly outcome: GameOutcome | null
  readonly moveNumber: number

  /** null when the server sent a board this client cannot read. See readBoard. */
  readonly board: GomokuState | null
}

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

// A snapshot arrives whole, so it is read once, here, rather than on every
// render. The page never touches payload.state itself.
function viewFromState(payload: MatchStatePayload): MatchView {
  return {
    matchId: payload.matchId,
    players: payload.players,
    turn: payload.turn,
    outcome: payload.outcome,
    moveNumber: payload.moveNumber,
    board: readBoard(payload.game, payload.state),
  }
}

function MatchPage() {
  const { matchId } = useParams()
  const { join, leave, subscribe } = useSocket()
  const [received, setReceived] = useState<MatchView | null>(null)

  // A view counts only while we are still on the match it describes.
  // Navigating from one match to another would otherwise leave the previous
  // board on screen until the new snapshot arrived. Derived rather than reset
  // in the effect below, which would cost a second render every time.
  const view = received !== null && received.matchId === matchId ? received : null

  useEffect(() => {
    if (matchId === undefined) return

    const key = `match:${matchId}`
    join(key, joinMatch(matchId))

    // One socket serves the whole tab, so every event arrives here,
    // including events about other matches and other features.
    const unsubscribe = subscribe((event) => {
      if (event.type !== 'match.state') return
      if (event.payload.matchId !== matchId) return
      setReceived(viewFromState(event.payload))
    })

    return () => {
      unsubscribe()
      leave(key, leaveMatch(matchId))
    }
  }, [matchId, join, leave, subscribe])

  // TEMP: switch between the two stone styles so the team can pick one.
  // Kept in the URL (?stones=red) so either look can be shared as a link.
  // Delete the switch and the StoneStyle option once we have decided.
  const [searchParams, setSearchParams] = useSearchParams()
  const stones: StoneStyle = searchParams.get('stones') === 'red' ? 'red' : 'classic'

  function toggleStones() {
    setSearchParams(stones === 'red' ? {} : { stones: 'red' }, { replace: true })
  }

  if (matchId === undefined) {
    return <ErrorState message="This match could not be displayed." />
  }

  // TODO(#25): a match id nobody recognises is refused with match.rejected,
  // which nothing listens for yet, so this waits forever instead of saying so.
  if (view === null) {
    return <LoadingState message="Loading the match…" />
  }

  if (view.board === null) {
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
          <GomokuBoard state={view.board} stones={stones} />
        </div>
        <div className="w-full max-w-[32rem] xl:w-56 xl:justify-self-start">
          <MatchPlayers
            players={view.players}
            turn={view.turn}
            outcome={view.outcome}
            stones={stones}
          />
        </div>
      </div>
    </div>
  )
}

export default MatchPage
