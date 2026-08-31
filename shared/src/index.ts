/**
 * The public surface of @transcendence/shared.
 *
 * Anything the API or the frontend is allowed to import lives here. Importing a
 * deep path like "@transcendence/shared/dist/gomoku.js" is not supported and
 * will break the next time these files move.
 */

export type { GameEngine, GameOutcome, PlayerIndex } from "./types.js";

export { BOARD_SIZE, WIN_LENGTH, gomoku } from "./gomoku.js";
export type { Cell, GomokuMove, GomokuState } from "./gomoku.js";

export type {
	ChatClientEvent,
	ChatErrorCode,
	ChatServerEvent,
	ClientEvent,
	Envelope,
	ErrorCode,
	LifecycleClientEvent,
	LifecycleServerEvent,
	MatchClientEvent,
	MatchErrorCode,
	MatchJoinPayload,
	MatchLeavePayload,
	MatchMovedPayload,
	MatchMovePayload,
	MatchPlayer,
	MatchRejectedPayload,
	MatchResignPayload,
	MatchServerEvent,
	MatchStatePayload,
	ServerEvent,
	TransportErrorCode,
} from "./ws.js";
