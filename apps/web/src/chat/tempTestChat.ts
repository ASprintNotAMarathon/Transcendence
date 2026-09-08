import { chatClient, deliverIncomingAfter } from './chat'

// conversation-1 is hardcoded in chat.ts in the messages array

console.log('\nHISTORY TEST:')

console.log(chatClient.loadHistory('conversation-1'))
console.log(chatClient.loadHistory('conversation-2'))

console.log('\nSEND TEST:')

// Listen for events produced by the chat client
const unsubscribe = chatClient.subscribe((event) => {
	console.log('Received chat server event:', event)
})

// Browser/client → chat server
chatClient.sendMessage('conversation-1', 'Message FROM BROWSER to CHAT SERVER')

console.log('\nUNSUBSCRIBING:')

unsubscribe()

// This message should NOT produce an event because we unsubscribed
chatClient.sendMessage(
	'conversation-1',
	'This message should NOT produce an event',
)

unsubscribe()

console.log('\nDELAYED MESSAGE TEST:')

// Pretend that the chat server sends a message to the browser with a 10-second delay
const incomingMessage = {
	conversationId: 'conversation-1',
	messageId: 'message-delayed-1',
	senderId: 'chat-server',
	senderName: 'CHAT SERVER',
	body: 'Message FROM CHAT SERVER to BROWSER',
	createdAt: new Date().toISOString(),
}

// Subscribe to messages/events coming from the chat server
chatClient.subscribe((event) => {
	console.log('Received message FROM CHAT SERVER:', event)
})

// Simulate the server sending the message 10 seconds later
deliverIncomingAfter(incomingMessage, 10000)

console.log('Waiting for message FROM CHAT SERVER...')
