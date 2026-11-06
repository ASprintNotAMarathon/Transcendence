/*
Builders for every message the client sends.

The socket layer forwards whatever these return,
so this is the only place in the frontend that knows the shape of an outgoing message.
*/

import type { ClientEvent } from '@transcendence/shared'

/** Start receiving updates for a match, as a player or as a spectator. */
export function joinMatch(matchId: string, cid?: string): ClientEvent {
  return { type: 'match.join', cid, payload: { matchId } }
}

/** Stop receiving updates. Does not forfeit the match. */
export function leaveMatch(matchId: string, cid?: string): ClientEvent {
  return { type: 'match.leave', cid, payload: { matchId } }
}

/** Offer a move. The server decides whether it is legal and replies or broadcasts. */
export function sendMove(matchId: string, move: unknown, cid?: string): ClientEvent {
  return { type: 'match.move', cid, payload: { matchId, move } }
}

/** Concede the match. */
export function resign(matchId: string, cid?: string): ClientEvent {
  return { type: 'match.resign', cid, payload: { matchId } }
}

/** Send a new chat message to a conversation. */
export function sendChatMessage(conversationId: string, body: string, cid?: string): ClientEvent {
  return { type: 'chat.send', cid, payload: { conversationId, body } }
}

/** Ask for one page of a conversation's history; `before` pages further back. */
export function chatHistory(conversationId: string, before?: string, cid?: string): ClientEvent {
  return { type: 'chat.history', cid, payload: { conversationId, before } }
}

/** Ask for your own conversation list. */
export function chatConversations(cid?: string): ClientEvent {
  return { type: 'chat.conversations', cid, payload: {} }
}
