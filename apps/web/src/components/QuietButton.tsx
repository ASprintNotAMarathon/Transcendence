import type { ReactNode } from 'react'

type Props = {
	onClick: () => void
	disabled?: boolean
	className?: string
	children: ReactNode
}

/*
  QuietButton. An action you rarely want: decline a request, remove a
  friend, cancel, resign.

  It looks like a link on purpose, so it does not compete with the main
  button beside it. The main action stays an outlined pill.
*/
function QuietButton({ onClick, disabled = false, className = '', children }: Props) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`text-sm text-muted underline hover:text-(--color-base-content) disabled:no-underline ${className}`}
		>
			{children}
		</button>
	)
}

export default QuietButton