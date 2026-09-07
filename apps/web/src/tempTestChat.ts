import { chatClient, deliverIncomingAfter} from './chat'

console.log('History:')
console.log(chatClient.loadHistory('conversation-1'))

console.log('\nSending message:')

const unsubscribe = chatClient.subscribe((event) => {
  console.log('Received event:', event)
})

chatClient.sendMessage('conversation-1', 'Test message')

console.log('\nUnsubscribing:')
unsubscribe()

chatClient.sendMessage('conversation-1', 'This should NOT produce an event')
unsubscribe()

console.log('\nDelayed incoming message:')

const incomingMessage = {
  conversationId: 'conversation-1',
  messageId: 'message-delayed-1',
  senderId: 'user-2',
  senderName: 'Bob',
  body: 'Delayed message from Bob',
  createdAt: new Date().toISOString(),
}

chatClient.subscribe((event) => {
  console.log('Received delayed event:', event)
})

deliverIncomingAfter(incomingMessage, 1000)

console.log('Waiting for delayed message...')
