/*
 * ConversationList renders one clickable row per conversation.
 *
 * It holds no state of its own: the parent (ChatPage) passes in the rows,
 * which one is selected, and a callback to run on click.
 *
 *   ChatPage ──props──▶ ConversationList
 *     conversations  the rows to draw
 *     selectedId     which row to highlight
 *     onSelect       called with the clicked row's id
 *                          │
 *                          ▼ click
 *   ChatPage stores the id and re-renders with the new selectedId
 */

import type { ConversationSummary } from './chat'

// Inputs this component receives from its parent (ChatPage)
type ConversationListProps = {
	conversations: ConversationSummary[]
	// null = nothing selected yet
	selectedId: string | null
	// Called with the clicked conversation's id; the parent decides what to do with it
	onSelect: (conversationId: string) => void
}

function ConversationList({
	conversations,
	selectedId,
	onSelect,
}: ConversationListProps) {
	return (
		// daisyUI "menu" styles the <ul> as a vertical list
		<ul className="menu w-full p-0">
			{conversations.map((conversation) => {
				const selected = conversation.conversationId === selectedId
				return (
					// key lets React track each row when the list changes
					<li key={conversation.conversationId}>
						{/* A <button>, not a <div>, so Tab + Enter work without extra code */}
						<button
							type="button"
							onClick={() =>
								onSelect(conversation.conversationId)
							}
							// Tells screen readers which row is the active one
							aria-current={selected ? 'true' : undefined}
							// menu-active is daisyUI's highlight for the selected row
							className={`flex flex-col items-start rounded-none ${selected ? 'menu-active' : ''}`}
						>
							<span className="font-semibold">
								{conversation.name}
							</span>
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