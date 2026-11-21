import Icon from '../components/Icon'

type Props = {
	open: boolean
	unread: number
	onToggle: () => void
}

/*
  The sage cross that closes the chat. It sits below the popup on a desktop
  and inside the top bar on a phone, so both use this one button.
*/
export function CloseCross({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Close chat"
			className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-(--color-secondary) text-(--color-base-100)"
		>
			<Icon name="close" size={20} />
		</button>
	)
}

/*
  ChatButton opens the chat: a sage speech bubble with the unread count, or
  three dots when there is nothing new. While the chat is open it is the
  cross, which a phone hides because the top bar carries its own.
*/
function ChatButton({ open, unread, onToggle }: Props) {
	if (open) {
		return (
			<div className="max-sm:hidden">
				<CloseCross onClick={onToggle} />
			</div>
		)
	}

	const label = unread > 0 ? `Open chat, ${unread} unread messages` : 'Open chat'

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={label}
			className="cursor-pointer rounded-xl"
		>
			<svg aria-hidden="true" width="52" height="48" viewBox="0 0 52 48">
				<path
					className="fill-(--color-secondary)"
					transform="translate(52 0) scale(-1 1)"
					d="M10 4h32a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H24l-10 9v-9h-4a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8z"
				/>
				{unread > 0 ? (
					<text x="26" y="26.5" textAnchor="middle" fontSize="17" fontWeight="800" className="fill-(--color-base-100)">
						{unread}
					</text>
				) : (
					<g className="fill-(--color-base-100)">
						<circle cx="17" cy="20" r="2.6" />
						<circle cx="26" cy="20" r="2.6" />
						<circle cx="35" cy="20" r="2.6" />
					</g>
				)}
			</svg>
		</button>
	)
}

export default ChatButton