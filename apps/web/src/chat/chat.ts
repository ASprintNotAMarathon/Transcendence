/*
 * chatClient is the browser-side code that communicates with the chat server.
 * This mock client hardcodes the simulation of the server, without a real server.
 * TODO(real chat): when the socket-backed client replaces this mock, delete 
 * - every `[mock chat]` console.log (sendMessage steps 1–3, subscribe) 
 * - MOCK_FAIL_PREFIX, MOCK_PING and deliverIncomingAfter 
 * 	Check with: rg "\[mock chat\]|MOCK_|deliverIncomingAfter" apps/web/src
 */

/*
 * typescript types needed for the chat client.
 */
import type { ChatMessagePayload, ChatServerEvent } from '@transcendence/shared'

/**
 * functions that any chat client must implement
 */
export interface ChatClient {
	/** Resolves once the server accepted the message; rejects if it refused it. */
	sendMessage(conversationId: string, body: string): Promise<void>

	subscribe(listener: (event: ChatServerEvent) => void): () => void

	loadHistory(
		conversationId: string,
		previousMessageId?: string,
	): Promise<ChatMessagePayload[]>

	listConversations(): ConversationSummary[]
}

export interface ConversationSummary {
	conversationId: string
	name: string
	lastMessage: string
}

/** TODO: replace this hardcoded ID when real authentication is connected.  */
export const CURRENT_USER_ID = 'current-user'

//20 messages per page
const HISTORY_PAGE_SIZE = 20

// Mock-only: a real server takes time to answer, so the mock waits a little
// too. Without this the loading state would never be visible.
//TODO: remove this when the backend is implemented, because the real server will have its own delay.
const MOCK_DELAY_MS = 300

// Mock-only: a message body starting with this makes sendMessage fail,
// so the "failed to send → retry" state can be tried without a broken server.
// TODO: remove this when the backend is implemented, because the real server will have its own error handling.
export const MOCK_FAIL_PREFIX = '!fail'

// Mock-only: sending this from ANY conversation makes Alice send a message
// into conversation-1 one second later — the only way to test the unread badge
// without a second browser.
//TODO: remove this when the backend is implemented, because the real server will have its own incoming messages.
export const MOCK_PING = '!ping'

/** Waits the given number of milliseconds. */
function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/*
 * This array is a fake database for the mock client.
 * TODO: messages → will be replaced by real backend/database data.
 */
const messages: ChatMessagePayload[] = [
	{
		conversationId: 'conversation-1',
		messageId: 'message-1',
		senderId: 'user-1',
		senderName: 'Alice',
		body: 'hello',
		createdAt: '2026-09-02T10:00:00.000Z',
	},
	{
		conversationId: 'conversation-2',
		messageId: 'message-2',
		senderId: 'user-2',
		senderName: 'Bob',
		body: 'I am good! Working on the project.',
		createdAt: '2026-09-02T10:01:00.000Z',
	},
	{
		conversationId: 'conversation-3',
		messageId: 'message-3',
		senderId: 'user-3',
		senderName: 'Charlie',
		body: 'This is a very long test message that should be long enough to wrap onto multiple lines inside the message bubble without pushing the conversation list away, breaking the layout, causing horizontal scrolling, or making any part of the chat page overflow outside its normal container.',
		createdAt: '2026-09-02T11:00:00.000Z',
	},
]

/*
 * These listeners belong to the frontend code.
 * They let the chat client notify the browser when a chat event(incoming/outgoing) arrives.
 * TODO:listeners → will be replaced by the real WebSocket/socket event mechanism.
 */
const listeners = new Set<(event: ChatServerEvent) => void>()


/**
 * The browser/client sends a message to the specified conversation.
 * @param conversationId - The ID of the conversation to send the message to.
 * @param body - The content of the message to be sent.
 */
// TODO: Replace local message creation/storage with backend message sending.
async function sendMessage(
	conversationId: string,
	body: string,
): Promise<void> {
	console.log('[mock chat] 1. sendMessage called:', conversationId, body)
	await wait(MOCK_DELAY_MS)
	// The real server refuses empty messages (ChatErrorCode 'chat.empty_message'),
	// so the mock does too. The composer blocks this earlier; this is the safety net.
	if (body.trim() === '') {
		throw new Error('chat.empty_message')
	}
	// Mock-only failure switch, see MOCK_FAIL_PREFIX.
	if (body.startsWith(MOCK_FAIL_PREFIX)) {
		throw new Error('mock: failed to send')
	}
	if (body === MOCK_PING) {
		deliverIncomingAfter(
			{
				conversationId: 'conversation-1',
				messageId: `message-ping-${Date.now()}`,
				senderId: 'user-1',
				senderName: 'Alice',
				body: 'ping!',
				createdAt: new Date().toISOString(),
			},
			1000,
		)
		return
	}
	const message: ChatMessagePayload = {
		conversationId,
		messageId: `message-${messages.length + 1}`,
		senderId: 'current-user',
		senderName: 'You',
		body,
		createdAt: new Date().toISOString(),
	}
	messages.push(message)
	// The sender's screen shows the message ONLY through this event (the
	// "echo"), never from its own local copy — the same rule the server will enforce.
	const event: ChatServerEvent = {
		type: 'chat.message',
		payload: message,
	}
	console.log('[mock chat] 2. event created (not the typed text — an envelope):', event)
	// ── SOCKET PLUG-IN POINT ──────────────────────────────────────────────
	// Real client: socket.emit('msg', { type: 'chat.send', payload: { conversationId, body } })
	// and the server answers with this same 'chat.message' event over the socket.
	// The mock skips the wire and hands the event straight to the listeners.
	console.log(`[mock chat] 3. delivering event to ${listeners.size} listener(s)`)
	listeners.forEach((listener) => listener(event))
}
/**
 * Subscribe registers the given listener function to receive future chat events. Unsubscribe reverses it
 *
 * @param listener - A function that will be called whenever a new chat event occurs.
 * @returns A function that can be called to unsubscribe the listener.
 */
// TODO: Replace local listener Set with WebSocket subscription.
function subscribe(listener: (event: ChatServerEvent) => void): () => void {
	console.log(`[mock chat] listener registered`)
	listeners.add(listener)
	function unsubscribe(): void {
		listeners.delete(listener)
		console.log(`[mock chat] listener removed`)
	}
	return unsubscribe
}
/**
 * Loads one page of chat history for the given conversation.
 *
 * Paging works backwards from the newest message:
 *   first call  → loadHistory(id)                → the newest HISTORY_PAGE_SIZE messages
 *   scroll up   → loadHistory(id, oldestShownId) → the HISTORY_PAGE_SIZE messages before that one
 *
 * @param conversationId - The ID of the conversation to load history for.
 * @param previousMessageId - The oldest message already shown; only messages older than it are returned.
 * @returns Up to HISTORY_PAGE_SIZE messages, oldest first.
 */
// TODO: Replace local array filtering with fetching history from the backend
//previousMessageId kept optional because the first load has no older message to start from
async function loadHistory(
	conversationId: string,
	previousMessageId?: string,
): Promise<ChatMessagePayload[]> {
	await wait(MOCK_DELAY_MS)
	// match all messages for the given conversationId and store in all
	const all = messages.filter(
		(message) => message.conversationId === conversationId,
	)
	//previousMessageId provided → find the index of that message in the all array,
	//no previousMessageId → set end to the length of the array to get the last page of messages
	const end = previousMessageId
		? all.findIndex((message) => message.messageId === previousMessageId)
		: all.length
	// findIndex gives -1 for an unknown id → nothing older to give
	if (end < 0) return []
	// Take the HISTORY_PAGE_SIZE messages just before the cut-off to return the previous page of messages.
	// Math.max stops the start going negative on the last (shortest) page.
	//extract the slice of messages from the all array starting from the calculated start index to the end index
	return all.slice(Math.max(0, end - HISTORY_PAGE_SIZE), end)
}

/**
 * Builds the rows for the conversation list, one per conversation.
 *
 * Messages are stored as one flat array, so first we group them by
 * conversationId, then turn each group into a row.
 */
// TODO: Replace with a conversations endpoint from the backend
function listConversations(): ConversationSummary[] {
	// map<conversationId(key), array of messages-1, 2, 3...(value)> pair
	const byConversation = new Map<string, ChatMessagePayload[]>()
	for (const message of messages) {
		// get the array of messages(value) for this conversationId(key),
		// if unavailable, start with an empty array for this conversation.
		const list = byConversation.get(message.conversationId) ?? []
		// Map.set(key, value): Map<K, V>
		byConversation.set(message.conversationId, [...list, message])
	}
	// map makes each message group into a ConversationSummary object, which is returned as an array of summaries/row.
	return [...byConversation].map(([conversationId, list]) => ({
		conversationId,
		//if senderId is not the current user, use senderName as the conversation name; otherwise, use 'Unknown' as a fallback.
		name:
			list.find((message) => message.senderId !== CURRENT_USER_ID)
				?.senderName ?? 'Unknown',
		// Messages are kept in chronological order, so the last item is the latest message.
		lastMessage: list[list.length - 1].body,
	}))
}

/*
 * This is the only object the rest of the frontend needs to import.
 * and only part to remain unchanged when the backend is implemented.
 */
export const chatClient: ChatClient = {
	sendMessage,
	subscribe,
	loadHistory,
	listConversations,
}

/**
 * Mock-only: simulates a message arriving from someone else after a delay.
 * TODO: Remove this function entirely when the backend is implemented.
 * This is only to test the delayed message functionality in the mock chat client.
 */
export function deliverIncomingAfter(
	message: ChatMessagePayload,
	delayMs: number,
): void {
	setTimeout(() => {
		messages.push(message)
		const event: ChatServerEvent = {
			type: 'chat.message',
			payload: message,
		}
		listeners.forEach((listener) => listener(event))
	}, delayMs)
}

// Enough history in conversation-1 to exercise paging (HISTORY_PAGE_SIZE = 20).
// Inserted at the front: `messages` must stay in chronological order.
messages.unshift(
	...Array.from({ length: 45 }, (_, i) => ({
		conversationId: 'conversation-1',
		messageId: `message-old-${i + 1}`,
		senderId: i % 3 === 0 ? CURRENT_USER_ID : 'user-1',
		senderName: i % 3 === 0 ? 'You' : 'Alice',
		body: `Older message number ${i + 1}`,
		createdAt: new Date(Date.UTC(2026, 8, 1, 8, i)).toISOString(),
	})),
)
