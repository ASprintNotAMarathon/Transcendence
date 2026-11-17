/*
 *  ChatPage is the chat itself, shown inside ChatPopup.
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
import { CURRENT_USER_ID, chatClient, unreadCounts } from '../chat/chat'
import ConversationList from '../chat/ConversationList'
import MessagePane from '../chat/MessagePane'
import EmptyState from '../components/states/EmptyState'
import { CloseCross } from '../components/ChatButton'

// ChatPage() is rendered inside the chat popup. The Message button can
// preselect a conversation through initialConversationId.
function ChatPage({
	className = 'h-[calc(100vh-10rem)]',
	onClose,
	initialConversationId,
}: {
	className?: string
	onClose: () => void
	initialConversationId?: string
}) {
	// Use the return of listConversations() to create the initial state when the chatPage initializes.
	// Later, setConversations updates the conversation list when a new chat event arrives.
	const [conversations, setConversations] = useState(() =>
		chatClient.listConversations(),
	)
	//useState returns two things: the current value (selectedId) and a function to change it (setSelectedId -null until selected).
	//setSelectedId is a useState setter function that updates the selectedId state variable. 
	//When called, it triggers a re-render of the component with the new selectedId value.
	const [selectedId, setSelectedId] = useState<string | null>(
		initialConversationId ?? null,
	)
	// Use object "Record" to map string conversationId(key) to number unread count(value).
	// The starting counts come from the module store (unreadCounts), so
	// messages counted while the popup was closed keep their badges here.
	// A preselected conversation starts read.
	const [unread, setUnread] = useState<Record<string, number>>(() => {
		const counts = { ...unreadCounts }
		if (initialConversationId !== undefined) {
			counts[initialConversationId] = 0
			unreadCounts[initialConversationId] = 0
		}
		return counts
	})

	function selectConversation(conversationId: string) {
		// Tell React which conversation is selected.
		setSelectedId(conversationId)
		// user selected and read the message, so reset the unread count for that conversation to 0
		// by using setUnread (and in the module store, so it stays 0 after a remount)
		setUnread((current) => ({ ...current, [conversationId]: 0 }))
		unreadCounts[conversationId] = 0
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
					// mark it as unread, in state and in the module store
					setUnread((current) => ({
						...current,
						[id]: (current[id] ?? 0) + 1,
					}))
					unreadCounts[id] = (unreadCounts[id] ?? 0) + 1
				}
			}),
		// Re-run the effect when selectedId changes.
		[selectedId],
	)

	// Empty state: nothing to list yet (spec: "no conversations yet")
	if (conversations.length === 0) {
		return (
			<div className={`flex flex-col ${className}`}>
				<div className="flex justify-end md:hidden">
					<CloseCross onClick={onClose} />
				</div>
				<EmptyState
					title="Chat"
					message="No conversations yet. Open a player's profile and press Message!"
				/>
			</div>
		)
	}
	// The selected conversation's summary — the pane needs the other person.
	const selected = conversations.find(
		(conversation) => conversation.conversationId === selectedId,
	)
	return (
		// grid -cols-1 means One column on phones, list + pane side by side from md (768px) up.
		// minmax(0,1fr) lets the pane shrink instead of pushing the page wider for long messages.
		//overflow-y-auto lets the conversation list scroll vertically when the list is very long.
		//md:border-r md:border-(--color-primary) adds a right border to the conversation list on medium screens and above.
		//aside is used for the conversation list, and section is used for the message pane.
		//overflow-x-hidden prevents horizontal scrolling in the conversation list.
		<div className={`grid ${className} grid-cols-1 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]`}>
			<aside
				className={`overflow-y-auto overflow-x-hidden md:border-r md:border-(--color-primary) ${selectedId ? 'max-md:hidden' : ''}`}
			>
				<div className="flex items-center gap-2 px-3 md:hidden">
					<h2 className="flex-1 font-barrio text-2xl">Chat</h2>
					<CloseCross onClick={onClose} />
				</div>
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
			<section className={`min-h-0 ${selectedId ? '' : 'max-md:hidden'}`}>
				{/*
				 * If a conversation is selected, show its messages.
				 *
				 * key={selectedId} makes React create a fresh MessagePane
				 * when the user switches to another conversation.
				 */}
				{selectedId ? (
					<MessagePane
						key={selectedId}
						conversationId={selectedId}
						otherUserId={selected?.otherUserId ?? ''}
						otherUserName={selected?.name ?? ''}
						onBack={() => setSelectedId(null)}
						onClose={onClose}
					/>
				) : (
					<EmptyState title="Chat" message="Pick a conversation." />
				)}
			</section>
		</div>
	)
}

export default ChatPage