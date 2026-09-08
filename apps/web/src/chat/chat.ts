/*
 * chatClient is the browser-side code that communicates with the chat server.
 * This mock client hardcodes the simulation of the server, without a real server.
 */


/*
 * typescript types needed for the chat client.
 */
import type {
  ChatMessagePayload,
  ChatServerEvent,
} from '@transcendence/shared'

/**
 * functions that any chat client must implement
 */
export interface ChatClient {
  sendMessage(conversationId: string, body: string): void

  subscribe(listener: (event: ChatServerEvent) => void): () => void

  loadHistory(conversationId: string): ChatMessagePayload[]
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
    body: 'Hey! How are you?',
    createdAt: '2026-09-02T10:00:00.000Z',
  },
  {
    conversationId: 'conversation-1',
    messageId: 'message-2',
    senderId: 'user-2',
    senderName: 'Bob',
    body: 'I am good! Working on the project.',
    createdAt: '2026-09-02T10:01:00.000Z',
  },
  {
    conversationId: 'conversation-2',
    messageId: 'message-3',
    senderId: 'user-3',
    senderName: 'Charlie',
    body: 'Hello!',
    createdAt: '2026-09-02T11:00:00.000Z',
  },
]

/*
 * These listeners belong to the frontend code.
 * They let the chat client notify the browser when a chat event(incoming/outgoing) arrives.
 * TODO:listeners → will be replaced by the real WebSocket/socket event mechanism.
 */
const listeners = new Set<(event: ChatServerEvent) => void>()
//new creates a new object/instance(here Set object) from a class by calling it's constructor function.
//Set is a built-in JavaScript object that allows to store unique values(here function listeners) of any type.
//ChatServerEvent type of the function's received parameter


/**
 * The browser/client sends a message to the specified conversation.
 * @param conversationId - The ID of the conversation to send the message to.
 * @param body - The content of the message to be sent.
 */
// TODO: Replace local message creation/storage with backend message sending.
function sendMessage(conversationId: string, body: string): void {
	//make message object
	const message: ChatMessagePayload = {
    conversationId,
    messageId: `message-${messages.length + 1}`,
    senderId: 'current-user',
    senderName: 'You',
    body,
    createdAt: new Date().toISOString(), 
  }
  messages.push(message)//Store the message in the messages array
  // Make a chat event object called "event"
  const event: ChatServerEvent = {
    type: 'chat.message',
    payload: message,
  }
  listeners.forEach((listener) => listener(event))//notify all subscribed listeners about the new chat message.
}
/**
 * Subscribe registers the given listener function to receive future chat events. Unsubscribe reverses it
 *
 * @param listener - A function that will be called whenever a new chat event occurs.
 * @returns A function that can be called to unsubscribe the listener.
 */
// TODO: Replace local listener Set with WebSocket subscription.
function subscribe(
    listener: (event: ChatServerEvent) => void
): () => void {

    // Add this listener so it receives future chat events.
    listeners.add(listener)

    // Implement unsubscribe() inside subscribe() so it has access to the listener variable.
	// Unsubscribe can be called anytime without needing to pass the listener again.
    function unsubscribe(): void {
        listeners.delete(listener)
    }
    return unsubscribe
}
/**
 * Loads the chat history for given conversationID. 
 *
 * @param conversationId - The ID of the conversation to load history for.
 * @returns An array of chat messages for the specified conversation.
 */
// TODO: Replace local array filtering with fetching history from the backend
function loadHistory(conversationId: string): ChatMessagePayload[] {
  return messages.filter(
    (message) => message.conversationId === conversationId,
  )
}

/*
 * This is the only object the rest of the frontend needs to import.
 * and only part to remain unchanged when the backend is implemented.
 */
export const chatClient: ChatClient = {
  sendMessage,
  subscribe,
  loadHistory,
}

/**
 * Mock-only: simulates a message arriving from someone else after a delay.
 * TODO: Remove this function entirely when the backend is implemented.
 * This is only to simulate the chat server sending a message to the browser after a delay.
 */
export function deliverIncomingAfter(
  message: ChatMessagePayload,
  delayMs: number,
): void {
  setTimeout(() => {
    messages.push(message)
    const event: ChatServerEvent = { type: 'chat.message', payload: message }
    listeners.forEach((listener) => listener(event))
  }, delayMs)
}