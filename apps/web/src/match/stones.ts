/*
 * Stone colours, shared by the board and the player panel beside it.
 *
 * Player 0 moves first, player 1 plays white. Two looks, still being decided:
 * - 'classic': player 0 plays black, like the landing page illustration.
 * - 'red': player 0 plays red, on a black board.
 */

import type { Cell } from '@transcendence/shared'

export type StoneStyle = 'classic' | 'red'

/*
 * Both of these return CSS, not colour values, so whatever they are handed to
 * must be a style declaration: `style={{ fill: … }}`, never `fill="…"`.
 * var() is not valid in an SVG presentation attribute — it does not fail
 * loudly, it just paints black.
 */

export function stoneFill(cell: Exclude<Cell, null>, stones: StoneStyle): string {
  if (cell === 1) return 'var(--color-stone-white)'
  return stones === 'red' ? 'var(--color-stone-red)' : 'var(--color-stone-black)'
}

// A dark stone is carried by its rim, not its fill: any near-black is ~1.1:1
// against this page. The rim is what makes it a stone, so it stays well clear
// of --color-board-line, or it reads as a circle of grid.
export function stoneStroke(cell: Exclude<Cell, null>, stones: StoneStyle): string {
  return cell === 0 && stones === 'classic' ? 'var(--color-stone-black-rim)' : 'none'
}
