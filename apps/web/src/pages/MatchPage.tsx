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
import { useAuth } from '../auth/AuthContext'
import ErrorState from '../components/states/ErrorState'
import LoadingState from '../components/states/LoadingState'
import { joinMatch, leaveMatch, sendMove } from '../lib/protocol'
import GomokuBoard from '../match/GomokuBoard'
import MatchPlayers from '../match/MatchPlayers'
import { useSocket } from '../socket/context'
interface MatchView {
  readonly matchId: string
  readonly players: readonly [MatchPlayer, MatchPlayer]
  readonly turn: PlayerIndex
  readonly outcome: GameOutcome | null
  readonly moveNumber: number
  readonly board: GomokuState | null
  readonly stale: boolean
}

const NOTICE_MS = 3000

const REJECTION_MESSAGES: Record<MatchErrorCode, string> = {
  'match.not_found': 'This match does not exist.',
  'match.not_a_player': 'You are a spectator!',
  'match.not_your_turn': "It's not your turn.",
  'match.malformed_move': 'That move could not be read.',
  'match.illegal_move': "That point can't be played.",
  'match.already_over': 'This match is already over.',
}

function readBoard(game: string, state: unknown): GomokuState | null {
  if (game !== gomoku.name) return null
  try {
    return gomoku.deserialize(state)
  } catch {
    return null
  }
}

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

function applyMoved(view: MatchView, payload: MatchMovedPayload): MatchView {
  if (view.board === null || view.stale) return view

  if (payload.moveNumber <= view.moveNumber) return view

  if (payload.moveNumber !== view.moveNumber + 1) return { ...view, stale: true }

  let board: GomokuState
  try {
    board = gomoku.apply(view.board, gomoku.parseMove(payload.move))
  } catch {
    return { ...view, stale: true }
  }

  return {
    ...view,
    board,
    turn: payload.turn,
    outcome: payload.outcome,
    moveNumber: payload.moveNumber,
  }
}

function MatchPage() {
  const { matchId } = useParams()
  const { user } = useAuth()

  const { join, leave, send, subscribe } = useSocket()
  const [received, setReceived] = useState<MatchView | null>(null)
  const [refused, setRefused] = useState<MatchRejectedPayload | null>(null)

  const view = received !== null && received.matchId === matchId ? received : null

  useEffect(() => {
    if (matchId === undefined) return

    const key = `match:${matchId}`
    join(key, joinMatch(matchId))

    const unsubscribe = subscribe((event) => {
      if (event.type === 'match.state') {
        if (event.payload.matchId !== matchId) return
        setReceived(viewFromState(event.payload))
        return
      }

      if (event.type === 'match.moved') {
        if (event.payload.matchId !== matchId) return

        setReceived((current) =>
          current === null || current.matchId !== matchId
            ? current
            : applyMoved(current, event.payload),
        )

        setRefused(null)
        return
      }

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

  const stale = view?.stale === true
  useEffect(() => {
    if (matchId !== undefined && stale) send(joinMatch(matchId))
  }, [matchId, stale, send])

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

  const seat = view.players.findIndex((player) => player.userId === user?.id)

  const myTurn = seat !== -1 && view.outcome === null && view.turn === seat

  const play = (move: GomokuMove) => {
    setRefused(null)
    send(sendMove(matchId, move))
  }

  const notice = refusedMove ? REJECTION_MESSAGES[refused.code] : null

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full justify-items-center gap-8 xl:grid-cols-[1fr_32rem_1fr] xl:items-start">
        <div className="flex w-full max-w-[32rem] flex-col items-center gap-3 xl:col-start-2">
          <GomokuBoard state={view.board} onPlay={play} preview={myTurn} />
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
