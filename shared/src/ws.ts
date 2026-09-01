/**
 * The WebSocket event protocol.
 *
 * Every message either side may send over the socket is listed here, once.
 * The API imports it to know what it is allowed to receive and emit;
 * the web app imports the same file to know what it is allowed to send and expect.
 * If a message is not in this file, it is not part of the protocol.
 *
 * Like the game engines, this file is pure types: no I/O, no Socket.IO import, no Node APIs.
 * It describes the shape of what crosses the wire, not how it gets there.
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
 * so the three sections below cannot collide as they grow.
 */
export type ErrorCode = TransportErrorCode | MatchErrorCode | ChatErrorCode;

/** Failures below the game layer: auth, envelope shape, unknown events. */
// TODO(#17, Renata): transport codes. `never` until then, so the union typechecks while this section is empty.
export type TransportErrorCode = never;

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
// TODO(#17, Sara): chat codes.
export type ChatErrorCode = never;

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
 * Chat and presence events
 * ========================================================================== */

// TODO(#17, Sara): chat.* and presence.
export type ChatClientEvent = never;
export type ChatServerEvent = never;

/* ==========================================================================
 * Connection lifecycle events
 * ========================================================================== */

// TODO(#17, Renata): connect, authenticate, disconnect, reconnect,
// and the generic transport error event if we decide errors are generic rather than per-domain.
export type LifecycleClientEvent = never;
export type LifecycleServerEvent = never;

/* ==========================================================================
 * The protocol
 * ========================================================================== */

/** Everything a client may send. */
export type ClientEvent =
	| LifecycleClientEvent
	| MatchClientEvent
	| ChatClientEvent;

/** Everything a server may send. */
export type ServerEvent =
	| LifecycleServerEvent
	| MatchServerEvent
	| ChatServerEvent;
