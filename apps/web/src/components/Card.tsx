import type { ElementType, ReactNode } from 'react'

/*
  Card. The one box style of the app: rounded, 2px border.

    <Card>                      grey border, for most things
    <Card highlighted>          red border, for "yours" or "current"
    <Card as="li" size="sm">    a different element, or tighter padding for rows
*/

type CardProps = {
  as?: ElementType
  size?: 'sm' | 'md'
  highlighted?: boolean
  className?: string
  children: ReactNode
}

// Full class names on purpose, so Tailwind can find them.
const PADDING = {
  sm: 'px-4 py-3',
  md: 'p-4',
}

function Card({ as: Tag = 'div', size = 'md', highlighted = false, className = '', children }: CardProps) {
  const look = highlighted
    ? 'border-(--color-primary) bg-(--color-base-100)'
    : 'border-(--color-board-line)'

    return <Tag className={`rounded-2xl border-2 ${look} ${PADDING[size]} ${className}`}>{children}</Tag>
}

export default Card