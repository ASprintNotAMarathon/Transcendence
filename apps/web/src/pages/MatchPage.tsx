/*
 * MatchPage is the screen behind /match/:matchId.
 *
 * It asks the server for the match and draws what comes back.
 * 
 * The board is never invented here: match.state carries it,
 * gomoku.deserialize validates it,
 * gomoku.apply is what moves it forward,
 * and this page renders whatever those return.
 *
 *   join ──────────────► match.state   the whole board, once
 *                        match.moved   one move at a time, from then on
 *   click ─────────────► match.move    an offer, drawn only once it comes back
 *                        match.rejected  a join or a move the server refused
 *
 * A gap in moveNumber means this tab missed a move. The cure is to rejoin,
 * which answers with a fresh board, so the view is marked stale
 * and the page sends match.join again.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { gomoku } from '@transcendence/shared'
import type {
  GameOutcome,
  GomokuMove,
  GomokuState,
  MatchMovedPayload,
  MatchErrorCode,
  MatchPlayer,
  MatchRejectedPayload,
  MatchStatePayload,
  PlayerIndex,
} from '@transcendence/shared'
import ErrorState from '../components/states/ErrorState'
import LoadingState from '../components/states/LoadingState'
import { devUserId, resolveMatchId } from '../lib/devFixtures'
import { joinMatch, leaveMatch, sendMove } from '../lib/protocol'
import GomokuBoard from '../match/GomokuBoard'
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

  /**
   * This board has fallen behind the server's:
   * a move was missed, or one would not play on it.
   * Moves are ignored until a fresh match.state replaces the whole view.
   */
  readonly stale: boolean
}

// The server sends a code and never prose, so the wording lives here.
// A Record rather than a switch so a code added to the protocol
// fails the build until it has a sentence.
// A refused join shows one as the whole page; a refused move, under the board.
// How long a refused move stays under the board.
const NOTICE_MS = 3000

const REJECTION_MESSAGES: Record<MatchErrorCode, string> = {
  'match.not_found': 'This match does not exist.',
  'match.not_a_player': 'You are an spectator!',
  'match.not_your_turn': "It's not your turn.",
  'match.malformed_move': 'That move could not be read.',
  'match.illegal_move': "That point can't be played.",
  'match.already_over': 'This match is already over.',
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
    stale: false,
  }
}

/*
 * The same match, one move later.
 */
function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView {
  if (view.board === null || view.stale) return view

  // Broadcasts are numbered, each one higher than the last.
  // Joining the room before reading the snapshot can deliver a move the snapshot
  // already holds (see match.handlers.ts), so a number we have passed is dropped
  // rather than played twice.
  if (payload.moveNumber <= view.moveNumber) return view

  // A number further ahead means a move in between never arrived.
  // Playing this one on top would draw a board nobody has.
  if (payload.moveNumber !== view.moveNumber + 1) return { ...view, stale: true }

  let board: GomokuState
  try {
    board = gomoku.apply(view.board, gomoku.parseMove(payload.move))
  } catch {
    // The server accepted this move against its own board,
    // so a throw here means the two boards have drifted apart.
    // Drawing it anyway would only widen the difference.
    return { ...view, stale: true }
  }

  // turn and outcome come from the payload, not from what apply worked out.
  // The server decides both, and a client that computes its own
  // would be the first thing to disagree.
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
  // real id alone. Everything below works on the resolved one,
  // which is what the api and every payload use.
  const { matchId: routeMatchId } = useParams()
  const matchId = resolveMatchId(routeMatchId)

  const { join, leave, send, subscribe } = useSocket()
  const [received, setReceived] = useState<MatchView | null>(null)
  const [refused, setRefused] = useState<MatchRejectedPayload | null>(null)

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

        // The board has moved on, so "it's not your turn" from before
        // no longer describes it.
        setRefused(null)
        return
      }

      // Kept whatever it refused. Only the render below decides it matters:
      // before a board arrives it can only be the join,
      // and after one it is a refused move, which leaves the board as it was.
      if (event.type === 'match.rejected') {
        if (event.payload.matchId !== matchId) return
        setRefused(event.payload)
      }
    })

    return () => {
      unsubscribe()
      leave(key, leaveMatch(matchId))
    }
  }, [matchId, join, leave, subscribe])

  // A stale board is replaced by joining again: the server answers every join
  // with a fresh match.state, and viewFromState clears the flag. Sent with
  // send, not join, because the standing join registered above already covers
  // reconnects; this only asks for one more snapshot.
  const stale = view?.stale === true
  useEffect(() => {
    if (matchId !== undefined && stale) send(joinMatch(matchId))
  }, [matchId, stale, send])

  // A refused move is a passing remark, so it goes after five seconds.
  // A refused join is not: with no board it is the whole page, and it stays.
  // Keyed on the refusal itself, so a new one starts the five seconds again.
  const refusedMove = view !== null && refused !== null && refused.matchId === matchId
  useEffect(() => {
    if (!refusedMove) return
    const timer = setTimeout(() => setRefused(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [refused, refusedMove])

  if (matchId === undefined) {
    return <ErrorState message="This match could not be displayed." />
  }

  if (view === null) {
    if (refused !== null && refused.matchId === matchId) {
      return <ErrorState message={REJECTION_MESSAGES[refused.code]} />
    }
    return <LoadingState message="Loading the match…" />
  }

  if (view.board === null) {
    return <ErrorState message="This match could not be displayed." />
  }

  // Which seat is yours, or -1 while you are only watching.
  // TEMP: devUserId. Becomes the logged-in user when #21 makes the two the same thing, and devIdentity.ts goes with it.
  const seat = view.players.findIndex((player) => player.userId === devUserId)

  // Only the player to move sees the stone a click would place.
  // Everyone else can still click, and the server says why it will not count:
  // it's not your turn, that point is taken, the match is over,
  // or you are only watching.
  const myTurn = seat !== -1 && view.outcome === null && view.turn === seat

  // Nothing is drawn here. The move is an offer: the server decides,
  // and the stone arrives with everybody else's copy of it, through match.moved.
  // Written as a const rather than a function:
  // a function can be called from anywhere in the page,
  // including above the guard that proves matchId is there,
  // so inside one it counts as possibly undefined again.
  // The last refusal is cleared on every click, so the same refusal twice
  // in a row still reads as a new answer rather than a leftover.
  const play = (move: GomokuMove) => {
    setRefused(null)
    send(sendMove(matchId, move))
  }

  const notice = refusedMove ? REJECTION_MESSAGES[refused.code] : null

  return (
    <div className="flex flex-col items-center gap-6">
      {/*
        Three columns so the board stays in the exact centre of the page:
        an empty one on the left balances the player panel on the right.
        Below xl there isn't room beside the board, so the panel goes under it.
      */}
      <div className="grid w-full justify-items-center gap-8 xl:grid-cols-[1fr_32rem_1fr] xl:items-start">
        <div className="flex w-full max-w-[32rem] flex-col items-center gap-3 xl:col-start-2">
          <GomokuBoard state={view.board} onPlay={play} preview={myTurn} />
          {/*
            Always in the page, empty when there is nothing to say:
            a screen reader only announces a live region it was already watching,
            and a reserved line keeps the board from jumping when one appears.
          */}
          <p aria-live="polite" className="min-h-5 text-center text-sm text-(--color-primary)">
            {notice}
          </p>
        </div>
        <div className="w-full max-w-[32rem] xl:w-56 xl:justify-self-start">
          <MatchPlayers players={view.players} turn={view.turn} outcome={view.outcome} />
        </div>
      </div>
    </div>
  )
}

export default MatchPage
