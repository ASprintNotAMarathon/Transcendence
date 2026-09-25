/*
 * MatchPage is the screen behind /match/:matchId.
 *
 * It asks the server for the match and draws what comes back.
 * The board is never invented here:
 * match.state carries it,
 * gomoku.deserialize validates it,
 * gomoku.apply is what moves it forward,
 * and this page renders whatever those return.
 *
 *   join ──────────────► match.state   the whole board, once
 *                        match.moved   one move at a time, from then on
 *   click ─────────────► match.move    an offer, drawn only once it comes back
 *
 * TODO(#25): a gap in moveNumber means this tab missed a move.
 * The cure is to rejoin, which answers with a fresh board.
 * Until then the move is dropped and this tab quietly stops keeping up.
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { gomoku } from '@transcendence/shared'
import type {
  GameOutcome,
  GomokuMove,
  GomokuState,
  MatchMovedPayload,
  MatchPlayer,
  MatchStatePayload,
  PlayerIndex,
} from '@transcendence/shared'
import ErrorState from '../components/states/ErrorState'
import LoadingState from '../components/states/LoadingState'
import { devUserId, resolveMatchId } from '../lib/devFixtures'
import { joinMatch, leaveMatch, sendMove } from '../lib/protocol'
import GomokuBoard from '../match/GomokuBoard'
import type { StoneStyle } from '../match/stones'
import MatchPlayers from '../match/MatchPlayers'
import { useSocket } from '../socket/context'

/*
 * What this page is showing right now.
 *
 * Not the payload the server sent: a payload is one message,
 * while this is the running picture that later messages update.
 * match.state replaces the whole view,
 * while match.moved carries one move rather than a board
 * and needs this to apply that move onto.
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

// A snapshot arrives whole, so it is read once, here,
// rather than on every render.
// The page never touches payload.state itself.
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

/*
 * The same match, one move later.
 */
function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView {
  if (view.board === null) return view

  // Broadcasts are numbered, each one higher than the last.
  // Joining the room before reading the snapshot can deliver a move the snapshot
  // already holds (see match.handlers.ts), so a number we have passed is dropped
  // rather than played twice.
  if (payload.moveNumber !== view.moveNumber + 1) return view

  let board: GomokuState
  try {
    board = gomoku.apply(view.board, gomoku.parseMove(payload.move))
  } catch {
    // The server accepted this move against its own board,
    // so a throw here means the two boards have drifted apart.
    // Drawing it anyway would only widen the difference.
    return view
  }

  // turn and outcome come from the payload, not from what apply worked out.
  // The server decides both, and a client that computes its own would be
  // the first thing to disagree.
  return {
    ...view,
    board,
    turn: payload.turn,
    outcome: payload.outcome,
    moveNumber: payload.moveNumber,
  }
}

function MatchPage() {
  // TEMP: resolveMatchId turns /match/demo into the seeded match and leaves a
  // real id alone. Everything below works on the resolved one, which is what
  // the api and every payload use.
  const { matchId: routeMatchId } = useParams()
  const matchId = resolveMatchId(routeMatchId)

  const { join, leave, send, subscribe } = useSocket()
  const [received, setReceived] = useState<MatchView | null>(null)

  // A view counts only while we are still on the match it describes.
  // Navigating from one match to another would otherwise leave the previous board
  // on screen until the new snapshot arrived.
  // Derived rather than reset in the effect below,
  // which would cost a second render every time.
  const view = received !== null && received.matchId === matchId ? received : null

  useEffect(() => {
    if (matchId === undefined) return

    const key = `match:${matchId}`
    join(key, joinMatch(matchId))

    // One socket serves the whole tab, so every event arrives here,
    // including events about other matches and other features.
    const unsubscribe = subscribe((event) => {
      if (event.type === 'match.state') {
        if (event.payload.matchId !== matchId) return
        setReceived(viewFromState(event.payload))
        return
      }

      if (event.type === 'match.moved') {
        if (event.payload.matchId !== matchId) return

        // This listener is built once and never sees a later render,
        // so the board to play the move on has to come from React
        // rather than from anything captured here.
        // A move that arrives before the first snapshot has nothing to land on
        // and is dropped: the snapshot is on its way and will already contain it.
        setReceived((current) =>
          current === null || current.matchId !== matchId
            ? current
            : applyMoved(current, event.payload),
        )
      }
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

  // Which seat is yours, or -1 while you are only watching.
  // TEMP: devUserId, because the socket introduces itself with that and the
  // api believes it. Becomes the logged-in user when #21 makes the two the
  // same thing, and devIdentity.ts goes with it.
  const seat = view.players.findIndex((player) => player.userId === devUserId)

  // Only the player to move is offered a click. A spectator, the player
  // waiting, and both players once the match is over all get the same board
  // without a handler, so it goes back to being a picture.
  const myTurn = seat !== -1 && view.outcome === null && view.turn === seat

  // Nothing is drawn here. The move is an offer: the server decides, and the
  // stone arrives with everybody else's copy of it, through match.moved.
  // Written as a const rather than a function: a function can be called from
  // anywhere in the page, including above the guard that proves matchId is
  // there, so inside one it counts as possibly undefined again.
  const play = (move: GomokuMove) => {
    send(sendMove(matchId, move))
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
          <GomokuBoard
            state={view.board}
            stones={stones}
            onPlay={myTurn ? play : undefined}
          />
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
