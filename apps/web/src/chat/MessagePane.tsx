/*
 * MessagePane shows the messages of ONE conversation, newest at the bottom.
 *
 * It talks to the mock chat client in two directions:
 *   chat.ts ──loadHistory()──▶ MessagePane   (first page on open, older pages on scroll-up)
 *   chat.ts ──subscribe()───▶ MessagePane   (new messages arrive live)
 *
 * The parent (ChatPage) only passes in a conversationId. When that id changes,
 * ChatPage remounts this component (via key=), so state here always belongs to
 * a single conversation.
 */

import { useEffect, useRef, useState } from 'react'
import type { ChatMessagePayload } from '@transcendence/shared'
import { CURRENT_USER_ID, chatClient } from './chat'
import LoadingState from '../components/LoadingState'
import MessageComposer from './MessageComposer'

type MessagePaneProps = {
	conversationId: string
}

/**
 * What to do with the scroll position after the next render.
 *   bottom → jump to the newest message (on open, or when a new message arrives)
 *   keep   → remember the scroll height
 */
type ScrollPlan = { to: 'bottom' } | { to: 'keep'; previousHeight: number }

/*
 * Converts the full ISO timestamp into a small readable time.
 *
 * Example:
 * "2026-09-11T12:30:00.000Z"
 *        ↓
 * "14:30"
 */
function formatTime(isoDate: string): string {
	return new Date(isoDate).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	})
}

function MessagePane({ conversationId }: MessagePaneProps) {
	/*
	 * useState returns TWO things:
	 *
	 * messages     = current array of messages
	 * setMessages  = function used to change that array
	 *
	 * Starts empty: the first page arrives from the (async) mock in the
	 * effect below, and `loading` is true until it does.
	 */
	const [messages, setMessages] = useState<ChatMessagePayload[]>([])
	const [loading, setLoading] = useState(true)
	// Reference to the scrollable <div(type)>, initially null
	const scrollRef = useRef<HTMLDivElement>(null)
	// A ref (not state) because changing it must not trigger a re-render
	// initially scroll to the bottom (newest message) when the pane opens
	const scrollPlan = useRef<ScrollPlan>({ to: 'bottom' })

	// Load the newest page once. `cancelled` guards against the answer arriving
	// after the user already switched conversation (the pane was unmounted).
	useEffect(() => {
		let cancelled = false
		chatClient.loadHistory(conversationId).then((page) => {
			if (cancelled) return
			scrollPlan.current = { to: 'bottom' }
			setMessages(page)
			setLoading(false)
		})
		return () => {
			cancelled = true
		}
	}, [conversationId])

	/*
	 * Subscribe to messages coming from the chat client.
	 * This effect runs when conversationId changes.
	 */
	useEffect(() => {
		return chatClient.subscribe((event) => {
			// Ignore events for other conversations
			if (
				event.type !== 'chat.message' ||
				event.payload.conversationId !== conversationId
			) {
				return
			}
			// Always scroll to the bottom when a new message arrives
			scrollPlan.current = { to: 'bottom' }
			//setMessages from the previous state to the new state by appending the new message to the current messages array
			setMessages((current) => [...current, event.payload])
		})
	}, [conversationId])

	// Runs after every change to `messages` and applies the scroll plan
	useEffect(() => {
		//name the current scrollable element for easier reading
		const element = scrollRef.current
		// The HTML element doesn't exist yet.
		if (!element) return
		//name the current scroll plan for easier reading
		const plan = scrollPlan.current
		/*
		 * If a new message arrived → scroll to the bottom.
		 *
		 * If older messages were added → adjust the scroll position so the user
		 *   stays looking at the same message.
		 */
		element.scrollTop =
			plan.to === 'bottom'
				? element.scrollHeight
				: // new height minus old height = how much was inserted above
					element.scrollHeight - plan.previousHeight
	}, [messages])

	// Scrolling to the very top asks the mock for the page before the oldest message shown
	async function handleScroll() {
		const element = scrollRef.current
		if (!element || element.scrollTop > 0 || messages.length === 0) return
		const older = await chatClient.loadHistory(
			conversationId,
			messages[0].messageId,
		)
		if (older.length === 0) return
		/** Remember the current scroll height before inserting the older messages */
		scrollPlan.current = {
			to: 'keep',
			previousHeight: element.scrollHeight,
		}
		/** Put the older messages BEFORE the existing messages. */
		setMessages((current) => [...older, ...current])
	}

	// Show the loading dots until the first page is in (spec: "loading state")
	if (loading) {
		return <LoadingState message="Loading messages…" />
	}

	return (
		// Column: the scrollable message list on top, the composer pinned below.
		// min-h-0 on the list lets it shrink and scroll instead of pushing the composer off-screen.
		<div className="flex h-full flex-col">
			<div
				ref={scrollRef}
				onScroll={() => void handleScroll()}
				className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2"
			>
				{messages.map((message, index) => {
					const mine = message.senderId === CURRENT_USER_ID
					// Show the sender's name only when it differs from the previous message
					//so one sender shows their name only once for a group of messages in a row
					const firstOfGroup =
						messages[index - 1]?.senderId !== message.senderId
					return (
						<div
							key={message.messageId}
							// My messages on the right, everyone else on the left
							className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${firstOfGroup ? 'mt-3' : ''}`}
						>
							{firstOfGroup && (
								<span className="max-w-full truncate text-sm text-muted">
									{/* Shows the sender's name */}
									{message.senderName}
								</span>
							)}
							{/* max-w + break-words: a long message wraps instead of widening the layout.
							    whitespace-pre-wrap keeps the newlines from Shift+Enter and pasted text. */}
							<div
								className={`max-w-[75%] rounded-2xl px-4 py-2 break-words whitespace-pre-wrap ${mine ? 'bg-(--color-primary) text-(--color-primary-content)' : 'bg-(--color-base-100)'}`}
							>
								<p>{message.body}</p>
								{/* dateTime keeps the exact timestamp; the visible text is just hh:mm */}
								<time
									dateTime={message.createdAt}
									className="block text-right text-xs text-muted"
								>
									{/* formats the timestamp into a small readable time */}
									{formatTime(message.createdAt)}
								</time>
							</div>
						</div>
					)
				})}
			</div>
			{/* The pane does NOT add the sent message itself; it arrives via subscribe() like any other */}
			<MessageComposer
				onSend={(body) => chatClient.sendMessage(conversationId, body)}
			/>
		</div>
	)
}

export default MessagePane
