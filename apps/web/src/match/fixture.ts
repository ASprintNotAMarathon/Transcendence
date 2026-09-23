/*
 * A hardcoded match.state reply, standing in for the server until the socket
 * provider (#24) exists.
 *
 * The board is built by playing real moves through the engine and serializing
 * the result, the same way MatchService.join does, so it is always something
 * gomoku.deserialize accepts. A hand-written board could drift out of shape
 * without anyone noticing.
 *
 * TODO(#24): delete this file once MatchPage receives match.state from the socket.
 */

import { gomoku } from '@transcendence/shared'
import type { GomokuMove, MatchStatePayload } from '@transcendence/shared'

const moves: GomokuMove[] = [
  { row: 7, col: 7 },
  { row: 7, col: 8 },
  { row: 8, col: 8 },
  { row: 6, col: 6 },
  { row: 8, col: 6 },
  { row: 9, col: 9 },
  { row: 8, col: 7 },
]

const position = moves.reduce(
  (state, move) => gomoku.apply(state, move),
  gomoku.initialState(),
)

export const fixtureMatchState: MatchStatePayload = {
  matchId: 'fixture-match',
  game: gomoku.name,
  players: [
    { userId: 'fixture-player-0', displayName: 'kimia' },
    { userId: 'fixture-player-1', displayName: 'renata' },
  ],
  turn: gomoku.turn(position),
  state: gomoku.serialize(position),
  outcome: gomoku.outcome(position),
  moveNumber: moves.length,
}
