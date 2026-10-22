import type { PlayerIndex } from "./types.js";
import type { MatchPlayer } from "./ws.js";

export interface LiveMatch {
	readonly matchId: string;
	readonly game: string;
	readonly players: readonly [MatchPlayer, MatchPlayer];
	readonly turn: PlayerIndex;
	readonly moveNumber: number;
	readonly startedAt: string;
}
