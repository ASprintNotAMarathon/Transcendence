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
import { CURRENT_USER_ID, chatClient } from '../chat/chat'
import ConversationList from '../chat/ConversationList'
import MessagePane from '../chat/MessagePane'
import EmptyState from '../components/states/EmptyState'


//ChatPage() gets rendered by React when the user navigates to /chat.

function ChatPage() {
	// Use the return of listConversations() to create the initial state when the chatPage initializes.
	// Later, setConversations updates the conversation list when a new chat event arrives.
	const [conversations, setConversations] = useState(() =>
		chatClient.listConversations(),
	)
	//useState returns two things: the current value (selectedId) and a function to change it (setSelectedId -null until selected).
	//setSelectedId is a useState setter function that updates the selectedId state variable. 
	//When called, it triggers a re-render of the component with the new selectedId value.
	const [selectedId, setSelectedId] = useState<string | null>(null)
	// Use object "Record" to map string conversationId(key) to number unread count(value). 
	// useState keeps track of the number of unread messages for each conversation.
	const [unread, setUnread] = useState<Record<string, number>>({})

	function selectConversation(conversationId: string) {
		// Tell React which conversation is selected.
		setSelectedId(conversationId)
		// user selected and read the message, so reset the unread count for that conversation to 0
		// by using setUnread
		setUnread((current) => ({ ...current, [conversationId]: 0 }))
	}

	// Listen for chat events. callback function whenever a new chat event happens.
	useEffect(
		() =>
			chatClient.subscribe((event) => {
				// Update the list of conversations whenever a new chat event occurs.
				setConversations(chatClient.listConversations())
				// If a message is from new person and its conversation is not open----
				if (
					event.type === 'chat.message' &&
					event.payload.conversationId !== selectedId &&
					event.payload.senderId !== CURRENT_USER_ID
				) {
					//make a new variable id to store the conversationId of the new message.
					const id = event.payload.conversationId
					// mark it as unread
					setUnread((current) => ({
						...current,
						[id]: (current[id] ?? 0) + 1,
					}))
				}
			}),
		// Re-run the effect when selectedId changes.
		[selectedId],
	)

	// Empty state: nothing to list yet (spec: "no conversations yet")
	if (conversations.length === 0) {
		return (
			<EmptyState
				title="Chat"
				message="No conversations yet. Start a match and say hello!"
			/>
		)
	}

	return (
		// grid -cols-1 means One column on phones, list + pane side by side from md (768px) up.
		// minmax(0,1fr) lets the pane shrink instead of pushing the page wider for long messages.
		//overflow-y-auto lets the conversation list scroll vertically when the list is very long.
		//md:border-r md:border-(--color-primary) adds a right border to the conversation list on medium screens and above.
		//aside is used for the conversation list, and section is used for the message pane.
		//overflow-x-hidden prevents horizontal scrolling in the conversation list.
		<div className="grid h-[calc(100vh-10rem)] grid-cols-1 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
			<aside className="overflow-y-auto overflow-x-hidden md:border-r md:border-(--color-primary)">
				<ConversationList
					conversations={conversations}
					selectedId={selectedId}
					onSelect={selectConversation}
					unread={unread}
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
