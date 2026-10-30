import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { gomoku } from '@transcendence/shared'
import type {
  GameOutcome,
  GomokuMove,
  GomokuState,
  MatchEndedPayload,
  MatchEndReason,
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
import { joinMatch, leaveMatch, resign, sendMove } from '../lib/protocol'
import GomokuBoard from '../match/GomokuBoard'
import MatchPlayers from '../match/MatchPlayers'
import MatchStatus from '../match/MatchStatus'
import ResignButton from '../match/ResignButton'
import { useSocket } from '../socket/context'
interface MatchView {
  readonly matchId: string
  readonly players: readonly [MatchPlayer, MatchPlayer]
  readonly turn: PlayerIndex
  readonly outcome: GameOutcome | null
  readonly endReason: MatchEndReason | null
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
    endReason: payload.endReason,
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
    endReason: payload.outcome === null ? null : 'played',
    moveNumber: payload.moveNumber,
  }
}

function applyEnded(view: MatchView, payload: MatchEndedPayload): MatchView {
  if (view.outcome !== null) return view

  return { ...view, outcome: payload.outcome, endReason: payload.reason }
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

      if (event.type === 'match.ended') {
        if (event.payload.matchId !== matchId) return

        setReceived((current) =>
          current === null || current.matchId !== matchId
            ? current
            : applyEnded(current, event.payload),
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

  const index = view.players.findIndex((player) => player.userId === user?.id)
  const seat = index === -1 ? null : (index as PlayerIndex)

  const playing = seat !== null && view.outcome === null
  const myTurn = playing && view.turn === seat
  const backToLobby = view.outcome !== null || seat === null

  const play = (move: GomokuMove) => {
    setRefused(null)
    send(sendMove(matchId, move))
  }

  const notice = refusedMove ? REJECTION_MESSAGES[refused.code] : null

  return (
    <div className="match-layout">
      <div className="match-status flex flex-wrap items-end justify-between gap-3 xl:flex-col xl:items-start">
        <MatchStatus
          players={view.players}
          seat={seat}
          turn={view.turn}
          outcome={view.outcome}
          endReason={view.endReason}
        />
        {backToLobby && (
          <Link to="/home" className="btn btn-sm shrink-0 tracking-wide border-2 btn-outline-accent">
            ← Back to lobby
          </Link>
        )}
      </div>
      <div className="match-board flex flex-col items-center gap-3">
        <GomokuBoard
          state={view.board}
          onPlay={view.outcome === null ? play : undefined}
          preview={myTurn}
          flash={view.outcome === null}
        />
        <p aria-live="polite" className="min-h-5 text-center text-sm text-(--color-primary)">
          {notice}
        </p>
      </div>
      <div className="match-players">
        <MatchPlayers players={view.players} turn={view.turn} outcome={view.outcome} />
      </div>
      {playing && (
        <div className="match-actions">
          <ResignButton key={matchId} onResign={() => send(resign(matchId))} />
        </div>
      )}
    </div>
  )
}

export default MatchPage
