/*
 * chatClient is the browser-side code that communicates with the chat server.
 * This mock client hardcodes the simulation of the server, without a real server.
 */

/*
 * typescript types needed for the chat client.
 */
import type { ChatMessagePayload, ChatServerEvent } from '@transcendence/shared'

/**
 * functions that any chat client must implement
 */
export interface ChatClient {
	sendMessage(conversationId: string, body: string): void

	subscribe(listener: (event: ChatServerEvent) => void): () => void

	loadHistory(conversationId: string,  previousMessageId?: string): ChatMessagePayload[]

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
function sendMessage(conversationId: string, body: string): void {
	const message: ChatMessagePayload = {
		conversationId,
		messageId: `message-${messages.length + 1}`,
		senderId: 'current-user',
		senderName: 'You',
		body,
		createdAt: new Date().toISOString(),
	}
	messages.push(message)
	const event: ChatServerEvent = {
		type: 'chat.message',
		payload: message,
	}
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
	listeners.add(listener)
	function unsubscribe(): void {
		listeners.delete(listener)
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
function loadHistory(
	conversationId: string,
	previousMessageId?: string,
): ChatMessagePayload[] {
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
