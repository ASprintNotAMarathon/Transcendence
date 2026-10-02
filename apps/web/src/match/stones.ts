import type { Cell } from '@transcendence/shared'

export function stoneFill(cell: Exclude<Cell, null>): string {
  return cell === 1 ? 'var(--color-stone-sage)' : 'var(--color-stone-terracotta)'
}
