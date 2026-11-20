import type { ReactNode } from 'react'

type Props = {
	children: ReactNode
	id?: string
	/* true tells a screen reader to read it out at once, for an error
	   that appears after something the user did. */
	live?: boolean
}

/*
  ErrorText. One look for every "that did not work" message.
*/
function ErrorText({ children, id, live = false }: Props) {
	return (
		<p id={id} role={live ? 'alert' : undefined} className="text-sm text-(--color-error)">
			{children}
		</p>
	)
}

export default ErrorText