/*
 * ChatPage is the screen behind the /chat route (mounted inside AppLayout's <Outlet />).
 *
 * It connects the conversation list on the left with the message pane
 * on the right.
 *
 *   ┌──────────────────┬──────────────────────────┐
 *   │ ConversationList │ MessagePane              │
 *   │ (left column)    │ (right column)           │
 *   │ click a row ─────┼─▶ setSelectedId(id)      │
 *   │                  │   pane remounts for id   │
 *   └──────────────────┴──────────────────────────┘
 */

import { useEffect, useState } from 'react'
import { chatClient } from '../chat/chat'
import ConversationList from '../chat/ConversationList'
import MessagePane from '../chat/MessagePane'
import EmptyState from '../components/EmptyState'

function ChatPage() {
	// Rows for the left column, loaded once from the mock when the page is created
	const [conversations, setConversations] = useState(() =>
		chatClient.listConversations(),
	)
	// null until the user clicks a row
	const [selectedId, setSelectedId] = useState<string | null>(null)

	// Any new message can change a row's "last message" text, so reload the rows on every chat event.
	// subscribe() returns its own unsubscribe function, which React calls when the page closes.
	useEffect(
		() =>
			chatClient.subscribe(() =>
				setConversations(chatClient.listConversations()),
			),
		[],
	)

	return (
		// One column on phones, list + pane side by side from md (768px) up.
		// minmax(0,1fr) lets the pane shrink instead of pushing the page wider for long messages.
		<div className="grid h-[calc(100vh-10rem)] grid-cols-1 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
			<aside className="overflow-y-auto md:border-r md:border-(--color-primary)">
				<ConversationList
					conversations={conversations}
					selectedId={selectedId}
					onSelect={setSelectedId}
				/>
			{/* Left side: list of conversations */}
			</aside>
			{/* Right side: messages for the selected conversation */}
			{/* min-h-0 lets the pane scroll inside the grid instead of overflowing it */}
			<section className="min-h-0">
								{/*
				 * If a conversation is selected, show its messages.
				 *
				 * key={selectedId} makes React create a fresh MessagePane
				 * when the user switches to another conversation.
				 */}
				{selectedId ? (
					<MessagePane key={selectedId} conversationId={selectedId} />
				) : (
					<EmptyState title="Chat" message="Pick a conversation." />
				)}
			</section>
		</div>
	)
}

export default ChatPage
