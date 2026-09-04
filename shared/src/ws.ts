/**
 * The WebSocket event protocol.
 *
 * Every message either side may send over the socket is listed here, once.
 * The API imports it to know what it is allowed to receive and emit;
 * the web app imports the same file to know what it is allowed to send and expect.
 * If a message is not in this file, it is not part of the protocol.
 *

 * Like the game engines, this file is pure types: no I/O, no Socket.IO import, no Node APIs.
 */

import type { GameOutcome, PlayerIndex } from "./types.js";

/* ==========================================================================
 * The envelope
 * ========================================================================== */

/**
 * The shape every message shares.
 *
 * Two halves. `type` and `cid` are the envelope: the same fields in the same place on every message.
 * `payload` is the letter inside, and its contents differ per message.
 *
 * Written once as a generic so that adding an envelope field later is a one-line change here
 * instead of an edit to every message in the file.
 */
export interface Envelope<TType extends string, TPayload> {
	/**
	 * Which message this is. Reading it tells TypeScript which fields `payload` has,
	 * the same way `kind` does on GameOutcome in types.ts.
	 */
	readonly type: TType;

	/**
	 * Correlation id: a ticket number the client stamps on a request so it can recognise the reply.
	 *
	 * Set by the client, echoed by the server on a direct reply to that one client.
	 * Absent on broadcasts, because a broadcast answers nobody.
	 * Optional: a client that never has two requests in flight can skip it.
	 */
	readonly cid?: string;

	readonly payload: TPayload;
}

/* ==========================================================================
 * Error codes
 * ========================================================================== */

/**
 * Why something was refused.
 *
 * Machine-readable, so the UI switches on the code and owns the wording.
 * The server never sends prose the client is expected to display.
 *
 * Codes are namespaced with the same prefixes as the event names,
 * so the four sections below cannot collide as they grow.
 * The ErrorCode union isn't used yet, it exists so a single error-display component can look up
 * wording for any code without knowing which family it came from.
 */
export type ErrorCode = TransportErrorCode | MatchErrorCode | ChatErrorCode | PresenceErrorCode;

/** Failures below the game and chat layers */
export type TransportErrorCode =
	/** Unreadable - invalid JSON or not shaped like an envelope */
	| "transport.malformed"
	/** Readable but not in protocol - type is one we never heard of */
	| "transport.unknown_event"
	/** Type is real but the payload is wrong */
	| "transport.invalid_payload"
	/** Too many messages too quickly. Socket stays open. */
	| "transport.rate_limited";

/** Failures the match runtime raises. */
export type MatchErrorCode =
	/** No match with that id, or it is over and gone. */
	| "match.not_found"
	/** You are watching this match, not playing in it. */
	| "match.not_a_player"
	/** Your opponent's turn. */
	| "match.not_your_turn"
	/** The engine could not parse this into a move at all. */
	| "match.malformed_move"
	/** A real move, but not a legal one in this position. */
	| "match.illegal_move"
	/** The game already ended. */
	| "match.already_over";

/** Failures in chat and presence. */
export type ChatErrorCode =
	| "chat.not_found"
	| "chat.empty_message"
	| "chat.message_too_long";


/** Failures in presence. */
export type PresenceErrorCode =
	| "presence.not_found"
	| "presence.already_online"
	| "presence.already_offline";

/* ==========================================================================
 * Match events
 * ========================================================================== */

/**
 * A player in a match, as far as the socket layer is concerned.
 */
export interface MatchPlayer {
	readonly userId: string;
	readonly displayName: string;
}

/** Ask to receive updates for a match, as a player or as a spectator. */
export interface MatchJoinPayload {
	readonly matchId: string;
}

/** Stop receiving updates. Not a resignation. */
export interface MatchLeavePayload {
	readonly matchId: string;
}

/** Concede. Ends the match as a win for the opponent. */
export interface MatchResignPayload {
	readonly matchId: string;
}

export interface MatchMovePayload {
	readonly matchId: string;

	/**
	 * Stays `unknown` on purpose.
	 *
	 * The transport does not know what a move is.
	 * It hands this to the engine's parseMove, which either returns a typed move or throws,
	 * and a throw becomes "match.malformed_move".
	 * That is the whole reason Reversi will reuse these events unchanged rather than needing a second set.
	 */
	readonly move: unknown;
}

/** The whole board. Sent when you join or rejoin a match, never after a move. */
export interface MatchStatePayload {
	readonly matchId: string;

	/** Which engine is running, matching GameEngine.name, e.g. "gomoku". */
	readonly game: string;

	/** Index 0 moves first, matching PlayerIndex. */
	readonly players: readonly [MatchPlayer, MatchPlayer];

	readonly turn: PlayerIndex;

	/** The board from the engine's serialize. Pass it to deserialize to get a typed state back. */
	readonly state: unknown;

	/** null while the match is still running. */
	readonly outcome: GameOutcome | null;

	/** The number of the last move played. 0 on a fresh board. */
	readonly moveNumber: number;
}

/** A move that was accepted and applied. Sent to everyone watching the match. */
export interface MatchMovedPayload {
	readonly matchId: string;

	/** Always one more than the last one you saw. A gap means you missed a move; rejoin. */
	readonly moveNumber: number;

	/** Who played it. The server knows this from the socket, it is never taken from the sender. */
	readonly by: PlayerIndex;

	/** The move as the engine parsed it. Apply it to your board the same way the server did. */
	readonly move: unknown;

	/** Whose turn it is now. */
	readonly turn: PlayerIndex;

	/** Non-null if this move ended the match. */
	readonly outcome: GameOutcome | null;
}

/** A move the server refused. Sent only to the player who sent it. */
export interface MatchRejectedPayload {
	readonly matchId: string;
	readonly code: MatchErrorCode;
}

/** Client to server. */
export type MatchClientEvent =
	| Envelope<"match.join", MatchJoinPayload>
	| Envelope<"match.leave", MatchLeavePayload>
	| Envelope<"match.move", MatchMovePayload>
	| Envelope<"match.resign", MatchResignPayload>;

/** Server to client. */
export type MatchServerEvent =
	| Envelope<"match.state", MatchStatePayload>
	| Envelope<"match.moved", MatchMovedPayload>
	| Envelope<"match.rejected", MatchRejectedPayload>;

/* ==========================================================================
 * Chat events
 * ========================================================================== */

/** Send a new message to a conversation. */
export interface ChatSendPayload {
	readonly conversationId: string;
	readonly body: string;
}

/** A message that was successfully created. */
export interface ChatMessagePayload {
	readonly conversationId: string;
	readonly messageId: string;
	readonly senderId: string;
	readonly senderName: string;
	readonly body: string;
	readonly createdAt: string;
}

/** Request the previous messages in a conversation. */
export interface ChatHistoryRequestPayload {
	readonly conversationId: string;
}

/** The previous messages in a conversation. */
export interface ChatHistoryPayload {
	readonly conversationId: string;
	readonly messages: readonly ChatMessagePayload[];
}

/** A message the server refused. */
export interface ChatRejectedPayload {
	readonly conversationId: string;
	readonly code: ChatErrorCode;
}

/** Client to server. */
export type ChatClientEvent =
	| Envelope<"chat.send", ChatSendPayload>
	| Envelope<"chat.history", ChatHistoryRequestPayload>;

/** Server to client. */
export type ChatServerEvent =
	| Envelope<"chat.message", ChatMessagePayload>
	| Envelope<"chat.history_result", ChatHistoryPayload>
	| Envelope<"chat.rejected", ChatRejectedPayload>;


/* ==========================================================================
 * Presence events
 * ========================================================================== */

/** A user whose online status is known to the socket layer. */
export interface PresenceUser {
	readonly userId: string;
	readonly displayName: string;
}

/** The list of users currently online. */
export interface PresenceListPayload {
	readonly users: readonly PresenceUser[];
}

/** A user has come online. */
export interface PresenceOnlinePayload {
	readonly user: PresenceUser;
}

/** A user has gone offline. */
export interface PresenceOfflinePayload {
	readonly userId: string;
}

/** Request the current list of online users. */
export type PresenceListRequestPayload = Record<string, never>;

/** Client to server. */
export type PresenceClientEvent =
	| Envelope<"presence.list", PresenceListRequestPayload>;

/** Server to client. */
export type PresenceServerEvent =
	| Envelope<"presence.state", PresenceListPayload>
	| Envelope<"presence.online", PresenceOnlinePayload>
	| Envelope<"presence.offline", PresenceOfflinePayload>;

/* ==========================================================================
 * Connection lifecycle events
 * ========================================================================== */

/** A failure below the game and chat layers */
export interface TransportErrorPayload {
	readonly code: TransportErrorCode;
}

/**
 * Transport-level events: the connection itself, rather than a game or a
 * conversation.
 *
 * The client side is empty on purpose. Everything a client might say about
 * the connection is an action rather than a message: connecting and authenticating
 * are the HTTP handshake, disconnecting is a close frame, and the heartbeat is
 * RFC 6455 ping/pong, which the ws library answers below this layer.
 *
 * Authentication never appears here for the same reason. It happens during the
 * handshake, so a failure means there is no socket to send anything on: the
 * client gets an HTTP 401 and no connection at all. A token that expires
 * mid-session is a close code, not an event.
 *
 * Rooms are server-internal. A room name is derived from ids the payloads
 * already carry (a match room from matchId) and never crosses the wire.
 * That is why no roomId field appears anywhere in this file.
 */
export type LifecycleClientEvent = never;
export type LifecycleServerEvent = Envelope<"transport.error", TransportErrorPayload>;

/* ==========================================================================
 * The protocol
 * ========================================================================== */

/** Everything a client may send. */
export type ClientEvent =
	| LifecycleClientEvent
	| MatchClientEvent
	| ChatClientEvent
	| PresenceClientEvent;

/** Everything a server may send. */
export type ServerEvent =
	| LifecycleServerEvent
	| MatchServerEvent
	| ChatServerEvent
	| PresenceServerEvent;
