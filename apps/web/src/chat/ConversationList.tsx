/*
 * ConversationList renders one clickable row per conversation.
 *
 * the parent (ChatPage) passes in the rows, which one is selected, and a callback to run on click.
 *
 */

import type { ConversationSummary } from './chat'

// Props that ConversationList receives from its parent, ChatPage.
type ConversationListProps = {
	conversations: ConversationSummary[] // The list of conversations to display.
	selectedId: string | null // The ID of the conversation currently selected, or null if none is selected.
	onSelect: (conversationId: string) => void // A callback function to be called when a conversation is selected.parameter:conversationId, returns:void 
	unread: Record<string, number> // A key(conversation ID)-value(that conversation's unread message count) object
}

function ConversationList({
	conversations,
	selectedId,
	onSelect,
	unread,
}: ConversationListProps) {
	return (
		// <ul> displays all conversations as a vertical list.
		// "menu" is a daisyUI class that provides menu/list styling.
		// "w-full" makes the list take up the full width of its container.
		// "flex-nowrap" prevents the list items from wrapping to the next line.
		// "p-0" removes padding from the list.
		<ul className="menu w-full flex-nowrap p-0">
			{conversations.map((conversation) => {
				// Check whether this conversation is currently selected.
				const selected = conversation.conversationId === selectedId
				// Get this conversation's unread count.
				// Use 0 if there is no unread count for this conversation.
				const unreadCount = unread[conversation.conversationId] ?? 0
				return (
					// key gives each conversation row a unique ID
					// so React can keep track of the rows.
					// min-w-0 allows the row to shrink and truncate its text when the list is too narrow.
					<li key={conversation.conversationId} className="min-w-0">
						{/* A button lets the user select the conversation with mouse or keyboard. */}
						<button
							type="button"
							onClick={() =>
								onSelect(conversation.conversationId)
							}
							// Tells screen readers that this is the currently selected conversation.
							aria-current={selected ? 'true' : undefined}
							// menu-active highlights the button when this conversation is selected.
							// flex = horizontal layout, w-full = full width, min-w-0 = allow truncation, 
							// flex-col = vertical layout for the text, items-start = left-align text, rounded-none = no rounded corner
							className={`flex w-full min-w-0 flex-col items-start rounded-none ${selected ? 'menu-active' : ''}`}

						>
							<span className="flex w-full items-center justify-between gap-2">
								{/* Display the conversation name. */}
								{/* "truncate" cuts off a long name with "...". */}
								<span className="min-w-0 truncate font-semibold">
									{/* Shows the name in conversationlist */}
									{conversation.name}
								</span>
								{unreadCount > 0 && (
									// aria-label shows the unread message count only when it is greater than 0.
									<span
										className="badge badge-sm badge-outline badge-primary shrink-0"
										aria-label={`${unreadCount} unread`}
									>
										{unreadCount}
									</span>
								)}
							</span>
							{/* Display the last message as a preview. */}
							{/* truncate cuts a long last message to one line with "…" */}
							<span className="w-full truncate text-sm text-muted">
								{conversation.lastMessage}
							</span>
						</button>
					</li>
				)
			})}
		</ul>
	)
}

export default ConversationList
