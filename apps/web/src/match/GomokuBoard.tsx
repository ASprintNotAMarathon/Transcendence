/*
 * GomokuBoard draws a 15×15 board from a GomokuState and nothing else.
 *
 * It holds no state and knows nothing about the socket:
 * whoever renders it owns the position, which is always what the server last sent.
 * A click is reported through onPlay and changes nothing here;
 * the stone appears when the server sends it back.
 * Stones sit on line intersections,
 * so BOARD_SIZE lines give BOARD_SIZE × BOARD_SIZE playable points.
 *
 * Stone colours come from stones.ts. The 'red' look also puts a black board under the grid.
 * Both looks sit on the same soft glow as the landing page illustration.
 */

import { useId, useMemo } from 'react'
import { BOARD_SIZE, gomoku } from '@transcendence/shared'
import type { GomokuMove, GomokuState } from '@transcendence/shared'
import { stoneFill, stoneStroke } from './stones'
import type { StoneStyle } from './stones'

const SPACING = 32
const PADDING = 24
const STONE_RADIUS = 13
const SIZE = SPACING * (BOARD_SIZE - 1)

// The traditional marker points on a 15×15 board: the centre and four around it.
const STAR_POINTS = [
  [3, 3], [3, 11], [7, 7], [11, 3], [11, 11],
] as const

const lines = Array.from({ length: BOARD_SIZE }, (_, i) => i * SPACING)

// Defined once here, not inside the component, so the 30 grid lines share one
// object instead of building a new one on every render.
// Styles rather than attributes: var() only resolves in a declaration,
// see the note in stones.ts.
const gridLine = { stroke: 'var(--color-board-line)' }
const starPoint = { fill: 'var(--color-board-line)' }

type GomokuBoardProps = {
  state: GomokuState
  stones?: StoneStyle

  /*
   * Called with the point that was clicked, and never with an illegal one.
   * Left out for a spectator, between turns, and once the match is over:
   * without it the board is the picture it has always been.
   */
  onPlay?: (move: GomokuMove) => void
}

function GomokuBoard({ state, stones = 'classic', onPlay }: GomokuBoardProps) {
  const { board, moveCount } = state
  const glowId = useId()

  // Which points may be clicked is the engine's answer, not this file's:
  // every empty one, and none at all once somebody has won.
  const playable = useMemo(
    () => (onPlay === undefined ? [] : gomoku.legalMoves(state)),
    [onPlay, state],
  )

  return (
    <svg
      viewBox={`${-PADDING} ${-PADDING} ${SIZE + PADDING * 2} ${SIZE + PADDING * 2}`}
      role="img"
      aria-label={`Gomoku board, ${moveCount} stones played`}
      className="h-auto w-full max-w-[32rem] overflow-visible"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: 'var(--color-secondary)' }} stopOpacity="0.18" />
          <stop offset="100%" style={{ stopColor: 'var(--color-secondary)' }} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The glow spills past the board, so it must not catch clicks meant for what sits around it. */}
      <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 1.4} fill={`url(#${glowId})`} pointerEvents="none" />

      {stones === 'red' && (
        <rect
          x={-PADDING}
          y={-PADDING}
          width={SIZE + PADDING * 2}
          height={SIZE + PADDING * 2}
          rx={12}
          strokeWidth={1}
          style={{ fill: 'var(--color-board-surface)', stroke: 'var(--color-board-line)' }}
        />
      )}

      {lines.map((pos) => (
        <line key={`h-${pos}`} x1={0} y1={pos} x2={SIZE} y2={pos} strokeWidth={1} style={gridLine} />
      ))}
      {lines.map((pos) => (
        <line key={`v-${pos}`} x1={pos} y1={0} x2={pos} y2={SIZE} strokeWidth={1} style={gridLine} />
      ))}

      {STAR_POINTS.map(([row, col]) => (
        <circle key={`star-${row}-${col}`} cx={col * SPACING} cy={row * SPACING} r={3} style={starPoint} />
      ))}

      {board.flatMap((cells, row) =>
        cells.map((cell, col) =>
          cell === null ? null : (
            <circle
              key={`${row}-${col}`}
              cx={col * SPACING}
              cy={row * SPACING}
              r={STONE_RADIUS}
              strokeWidth={1}
              style={{ fill: stoneFill(cell, stones), stroke: stoneStroke(cell, stones) }}
            />
          ),
        ),
      )}

      {/*
        Last, so the targets sit above the grid and catch the click themselves.
        Each one is the stone that would be played, kept invisible until the
        pointer is on it: the preview and the hit area are the same circle, so
        what lights up is exactly what a click would place.
      */}
      {playable.map((move) => (
        <circle
          key={`play-${move.row}-${move.col}`}
          cx={move.col * SPACING}
          cy={move.row * SPACING}
          r={STONE_RADIUS}
          className="cursor-pointer opacity-0 transition-opacity hover:opacity-40"
          style={{ fill: stoneFill(state.turn, stones) }}
          onClick={() => onPlay?.(move)}
        />
      ))}
    </svg>
  )
}

export default GomokuBoard
