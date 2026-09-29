/*
 * Stone colours, shared by the board and the player panel beside it.
 *
 * Player 0 moves first and plays terracotta, player 1 plays sage.
 */

import type { Cell } from '@transcendence/shared'

/*
 * This returns CSS, not a colour value, so whatever it is handed to must be a
 * style declaration: `style={{ fill: … }}`, never `fill="…"`.
 * var() is not valid in an SVG presentation attribute — it does not fail
 * loudly, it just paints black.
 */
export function stoneFill(cell: Exclude<Cell, null>): string {
  return cell === 1 ? 'var(--color-stone-sage)' : 'var(--color-stone-terracotta)'
}
