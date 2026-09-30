import { useId, useMemo } from 'react'
import { BOARD_SIZE, gomoku, winningLine } from '@transcendence/shared'
import type { GomokuMove, GomokuState } from '@transcendence/shared'
import { stoneFill } from './stones'

const SPACING = 32
const PADDING = 24
const STONE_RADIUS = 13
const SIZE = SPACING * (BOARD_SIZE - 1)

const STAR_POINTS = [
  [3, 3], [3, 11], [7, 7], [11, 3], [11, 11],
] as const

const lines = Array.from({ length: BOARD_SIZE }, (_, i) => i * SPACING)

const gridLine = { stroke: 'var(--color-board-line)' }
const starPoint = { fill: 'var(--color-board-line)' }

type GomokuBoardProps = {
  state: GomokuState
  onPlay?: (move: GomokuMove) => void
  preview?: boolean
}

function GomokuBoard({ state, onPlay, preview = true }: GomokuBoardProps) {
  const { board, moveCount, lastMove } = state
  const glowId = useId()

  const lastBy = lastMove === null ? null : board[lastMove.row][lastMove.col]
  const lastPlayed = lastMove === null || lastBy === null ? null : { ...lastMove, by: lastBy }

  const won = useMemo(
    () => new Set(winningLine(state).map((move) => move.row * BOARD_SIZE + move.col)),
    [state],
  )

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
              className={won.size === 0 ? undefined : won.has(row * BOARD_SIZE + col) ? 'stone-won' : 'stone-lost'}
              style={{ fill: stoneFill(cell) }}
            />
          ),
        ),
      )}

      {lastPlayed !== null && (
        <circle
          key={`flash-${moveCount}`}
          cx={lastPlayed.col * SPACING}
          cy={lastPlayed.row * SPACING}
          r={STONE_RADIUS}
          strokeWidth={3}
          pointerEvents="none"
          className="stone-flash"
          style={{ fill: 'none', stroke: stoneFill(lastPlayed.by) }}
        />
      )}

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
