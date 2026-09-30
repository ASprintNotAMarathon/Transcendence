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
 * Stone colours come from stones.ts. The grid has no surface of its own:
 * it sits straight on the same soft glow as the landing page illustration.
 */

import { useId, useMemo } from 'react'
import { BOARD_SIZE, gomoku } from '@transcendence/shared'
import type { GomokuMove, GomokuState } from '@transcendence/shared'
import { stoneFill } from './stones'

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

  /*
   * Called with the point that was clicked, legal or not:
   * the server is the one that says no, and says why.
   * Left out and the board is the picture it has always been.
   */
  onPlay?: (move: GomokuMove) => void

  /*
   * Whether hovering shows the stone a click would place.
   * Off when the click is not yours to make, between turns or while watching:
   * the point still answers, so the server can say why,
   * but it never shows a stone that is not going to appear.
   */
  preview?: boolean
}

function GomokuBoard({ state, onPlay, preview = true }: GomokuBoardProps) {
  const { board, moveCount } = state
  const glowId = useId()

  // Which points are legal is the engine's answer, not this file's:
  // every empty one, and none at all once somebody has won.
  // Only those respond to the pointer. The rest still take a click,
  // so a stone or a finished game gets the server's reason instead of silence.
  const legal = useMemo(
    () => new Set(
      onPlay === undefined
        ? []
        : gomoku.legalMoves(state).map((move) => move.row * BOARD_SIZE + move.col),
    ),
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
              style={{ fill: stoneFill(cell) }}
            />
          ),
        ),
      )}

      {/*
        Last, so the targets sit above the grid and the stones and catch the click themselves.
        One on every point. On a legal one it is the stone that would be played,
        kept invisible until the pointer is on it: the preview and the hit area
        are the same circle, so what lights up is exactly what a click would place.
      */}
      {onPlay !== undefined && board.flatMap((cells, row) =>
        cells.map((_, col) => (
          <circle
            key={`play-${row}-${col}`}
            cx={col * SPACING}
            cy={row * SPACING}
            r={STONE_RADIUS}
            className={
              preview && legal.has(row * BOARD_SIZE + col)
                ? 'cursor-pointer opacity-0 transition-opacity hover:opacity-40'
                : 'opacity-0'
            }
            style={{ fill: stoneFill(state.turn) }}
            onClick={() => onPlay({ row, col })}
          />
        )),
      )}
    </svg>
  )
}

export default GomokuBoard
