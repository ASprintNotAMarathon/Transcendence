/**
 * Room names.
 *
 * A room name is server-internal: it is derived from an id the payloads
 * already carry and never crosses the wire. Every slice that addresses a room
 * builds the name from here rather than writing the string itself, so there is
 * one definition to change.
 */

/** Every socket one user has open. Joined on connect, left automatically on disconnect. */
export function userRoom(userId: string): string {
	return `user:${userId}`;
}

/** Everyone watching one match - both players and any spectators */
export function matchRoom(matchId: string): string {
	return `match:${matchId}`;
}

/** Everyone in one conversation - for Chat. */
export function conversationRoom(conversationId: string): string {
	return `conversation:${conversationId}`;
}
