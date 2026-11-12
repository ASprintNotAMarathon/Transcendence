/*
 * 
 * Why this file lives in web/src/chat and not api/src/chat: 
 * this is the BROWSER's half of chat — it runs in the user's tab and asks questions
 * over the socket
 * 
 * 
/*
 * chatClient is the connection between the chat screens and the real chat
 * server.
 *
 * The screens use four functions from this file. This file handles the
 * communication with the server through the socket:
 *
 *   sendMessage       → sends a message to the server
 *   loadHistory       → asks the server for previous messages
 *   listConversations → returns the saved conversation list
 *   subscribe         → listens for chat events from the server and passes
 *                       them to the screens
 *
 * When we send a request, we give it a unique id called cid.
 * The server sends that same id back in its response, so we know which
 * request the response belongs to.
 */

import type { ChatMessagePayload, ChatServerEvent, ServerEvent } from '@transcendence/shared'
import { chatConversations, chatHistory, sendChatMessage } from '../lib/protocol'
import { clientSocket } from '../lib/socket'

/**
 * functions that any chat client must implement
 */
export interface ChatClient {

	sendMessage(conversationId: string, body: string): Promise<void>

	subscribe(listener: (event: ChatServerEvent) => void): () => void

	loadHistory(
		conversationId: string,
		previousMessageId?: string,
	): Promise<ChatMessagePayload[]>

	listConversations(): ConversationSummary[]
}

/** Data returned by listConversations() to display conversations in the frontend sidebar. */
export interface ConversationSummary {
	conversationId: string
	name: string
	lastMessage: string
}


/**
 * Stores the logged-in user's ID.
 * Starts empty and updated by setCurrentUserId() after login.
 * Uses let because its value needs to change after login.
 */
export let CURRENT_USER_ID = ''

export function setCurrentUserId(userId: string): void {
	CURRENT_USER_ID = userId
}

/** How long to wait for the server before a question counts as failed. */
const REPLY_TIMEOUT_MS = 5000

/** The screens' listeners that receive incoming chat events. */
const listeners = new Set<(event: ChatServerEvent) => void>()

/** Stores frontend requests waiting for a reply from the backend server */
interface PendingReply<T> {
	resolve: (value: T) => void
	reject: (reason: Error) => void
	timer: ReturnType<typeof setTimeout>
}

/** Stores frontend history requests waiting for chat.history_result from the backend */
const pendingHistory = new Map<string, PendingReply<ChatMessagePayload[]>>()

/**
 * Stores frontend message requests waiting for confirmation from the backend.
 * A rejected message is matched by cid; a successful message is confirmed
 * when the frontend receives its own chat.message event.
 */
const pendingSends = new Map<
	string,
	PendingReply<void> & { conversationId: string }
>()

/** Stores the latest conversation list received from the backend, returned by listConversations(). */
let conversations: ConversationSummary[] = []

/** Tracks whether the frontend has already requested the conversation list from the backend. */
let listRequested = false

/** Generates a new unique ID for each request. */
let nextCid = 0
function newCid(): string {
	nextCid += 1
	return `chat-${nextCid}`
}

/**
 * Handles events received from the backend.
 * Updates local data, resolves or rejects pending requests,
 * and forwards chat events to the frontend listeners.
 */
function handleServerEvent(event: ServerEvent): void {
	// Is this a history response, and does it have a request ID?
	if (event.type === 'chat.history_result' && event.cid !== undefined) 
	{
		// Find the history request that matches the response's request ID (cid)
		const pending = pendingHistory.get(event.cid)
		// If a matching request is found, remove it from the pendingHistory map and timeout
		if (pending !== undefined) {
			pendingHistory.delete(event.cid)
			clearTimeout(pending.timer)
			pending.resolve([...event.payload.messages])// Resolve the Promise and give the frontend the received messages.
		}
	}

	//Checks whether the backend sent an updated conversation list.
	if (event.type === 'chat.conversations_result') {
		// Replace local conversation list with the latest server data.
		conversations = event.payload.conversations.map((row) => ({
			conversationId: row.conversationId,
			name: row.otherUserName,
			lastMessage: row.lastMessageBody,
		}))
	}

	if (event.type === 'chat.message') {
		// find this conversation in existing list.
		const known = conversations.find(
			(summary) => summary.conversationId === event.payload.conversationId,
		)
		//if found, update the lastMessage preview with the new message body.
		if (known !== undefined) {
			known.lastMessage = event.payload.body
		} else {
			// If this conversation is unknown, request the list again.
			// We need the server to tell us the other participant's name.
			clientSocket.send(chatConversations())
		}

		// Checks whether the message was sent by the currently logged-in user.
		if (event.payload.senderId === CURRENT_USER_ID) {
			// Check the pending sends to find the one that matches the conversation ID of the received message.
			for (const [cid, pending] of pendingSends) {
				// If a match is found, remove it from the pendingSends map, clear the timeout, and resolve the Promise to indicate that the message was successfully sent.
				if (pending.conversationId === event.payload.conversationId) {
					pendingSends.delete(cid)
					clearTimeout(pending.timer)
					pending.resolve()
					break
				}
			}
		}
	}

	if (event.type === 'chat.rejected' && event.cid !== undefined) {
		// find the pending send that matches the request ID (cid)
		const send = pendingSends.get(event.cid)
		//if found, remove it from the pendingSends map, clear the timeout, and reject the Promise with an error
		if (send !== undefined) {
			pendingSends.delete(event.cid)
			clearTimeout(send.timer)
			send.reject(new Error(event.payload.code))
		}
		// find the pending history request that matches the request ID (cid)
		const history = pendingHistory.get(event.cid)
		//if found, remove it from the pendingHistory map, clear the timeout, and reject the Promise with an error
		if (history !== undefined) {
			pendingHistory.delete(event.cid)
			clearTimeout(history.timer)
			history.reject(new Error(event.payload.code))
		}
	}

	// Checks whether the event is a chat event before forwarding it to the frontend listeners.
	if (event.type.startsWith('chat.')) {
		// Go through all frontend components that subscribed to chat events.
		for (const listener of listeners) {
			// Forward the event so each subscribed component can react to it.
			listener(event as ChatServerEvent)
		}
	}
}


// This means every event received from the backend passes through that function.
// Registered once for the entire chat feature.


// SOCKET's SUBSCRIBE:
// Register handleServerEvent as the socket listener.
// Every event received from the backend is passed to handleServerEvent
clientSocket.subscribe(handleServerEvent)

function sendMessage(conversationId: string, body: string): Promise<void> {
	// Generate a unique ID to identify this message request.
	const cid = newCid()
	// Create a Promise so the frontend can wait for the server's response.
	return new Promise<void>((resolve, reject) => {
		// Start a timer in case the server doesn't respond within REPLY_TIMEOUT_MS
		const timer = setTimeout(() => {
			//remove the pending send from the map and reject the Promise with a timeout error.
			pendingSends.delete(cid)
			reject(new Error('chat.timeout'))
		}, REPLY_TIMEOUT_MS)
		// Save the request so handleServerEvent can find it when a response arrives.
		pendingSends.set(cid, { conversationId, resolve, reject, timer })
		// Send the message to the backend through the socket.
		clientSocket.send(sendChatMessage(conversationId, body, cid))
	})
}

// CHAT's SUBSCRIBE:
// Registers a frontend component to receive chat events.
// Returns a cleanup function to remove its listener when it unsubscribes.
function subscribe(listener: (event: ChatServerEvent) => void): () => void {
	// Register a frontend component so it receives incoming chat events.
	listeners.add(listener)
	//if conversation list has not been requested yet, request it from the backend.
	if (!listRequested) {
		// Mark it as requested to avoid sending duplicate requests.
		listRequested = true
		// Ask the backend for the conversation list of the added user
		//join() is used to subscribe to 'chat.conversations' to receive updates 
		// whenever the conversation list changes.
		clientSocket.join('chat.conversations', chatConversations())
	}
	// Return a cleanup function for the frontend component.
	return () => {
		// Remove the component from the listeners when it unsubscribes.
		listeners.delete(listener)
	}
}

function loadHistory(
	conversationId: string,
	previousMessageId?: string,
): Promise<ChatMessagePayload[]> {
	// Generate a unique ID to identify this history request.
	const cid = newCid()
	// Create a Promise so the frontend can wait for the history response.
	return new Promise<ChatMessagePayload[]>((resolve, reject) => {
		// Start a timer in case the backend doesn't respond within REPLY_TIMEOUT_MS
		const timer = setTimeout(() => {
			pendingHistory.delete(cid)
			reject(new Error('chat.timeout'))
		}, REPLY_TIMEOUT_MS)
		// Store the request so handleServerEvent can match the response using cid.
		pendingHistory.set(cid, { resolve, reject, timer })
		// Ask the backend for messages in this conversation.
		// previousMessageId is used when requesting older messages (pagination).
		clientSocket.send(chatHistory(conversationId, previousMessageId, cid))
	})
}

function listConversations(): ConversationSummary[] {
	return conversations
}

/*
 * The only object the rest of the frontend imports — unchanged shape,
 * which is exactly why the screens didn't notice the server became real.
 */
export const chatClient: ChatClient = {
	sendMessage,
	subscribe,
	loadHistory,
	listConversations,
}