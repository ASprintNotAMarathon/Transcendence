/**
 * Rebuilding a match from what the database stored.
 *
 * The board is not a column. A Match row plus its Move rows is the whole truth,
 * and this is where those rows become a position. Nothing here knows about
 * Prisma, sockets or HTTP: the row types are the narrowest shape a Prisma row
 * happens to satisfy, so the API passes its rows straight in.
 */

import type { GameEngine, GameOutcome, PlayerIndex } from "./types.js";

/**
 * One stored move, narrowed to the three columns a replay reads.
 *
 * `by` is number rather than PlayerIndex on purpose: the column is a plain int
 * and Postgres does not constrain it, so pretending it is already 0 or 1 would
 * move a lie out of the database and into the type system. replay() checks it.
 */
export interface MoveRow {
	readonly moveNumber: number;
	readonly by: number;
	readonly payload: unknown;
}

/** Everything a caller needs about a position, matching MatchStatePayload in ws.ts. */
export interface ReplayResult<TState> {
	readonly state: TState;

	/** Whose turn it is. Meaningless once `outcome` is set, because nobody moves again. */
	readonly turn: PlayerIndex;

	/** null while the game is still running. */
	readonly outcome: GameOutcome | null;

	/** The number of the last move played. 0 on a fresh board. */
	readonly moveNumber: number;
}

/**
 * Replay a stored history into a position, or throw.
 *
 * Every row is re-validated rather than trusted. A history that could not have
 * been produced by legal play is a bug somewhere upstream, and playing on top
 * of it would launder that bug into a board someone sees.
 *
 * The outcome is read after every move rather than once at the end: gomoku's
 * outcome() only scans the lines through lastMove, so a win looked for nowhere
 * is a win missed.
 */
export function replay<TState, TMove>(
	engine: GameEngine<TState, TMove>,
	rows: readonly MoveRow[],
): ReplayResult<TState> {
	let state = engine.initialState();
	let outcome = engine.outcome(state);

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		const expected = index + 1;

		// Not sorted here on purpose. Rows come back in whatever order the query
		// asked for, and a caller who forgot orderBy should find out now rather
		// than get a plausible board built from a shuffled history.
		if (row.moveNumber !== expected) {
			throw new Error(
				`corrupt match history: expected move ${expected}, got move ${row.moveNumber}`,
			);
		}

		if (row.by !== 0 && row.by !== 1) {
			throw new Error(
				`corrupt match history: move ${expected} was played by ${row.by}, not 0 or 1`,
			);
		}

		if (outcome !== null) {
			throw new Error(
				`corrupt match history: move ${expected} was played after the game ended`,
			);
		}

		const turn = engine.turn(state);
		if (row.by !== turn) {
			throw new Error(
				`corrupt match history: move ${expected} was played by ${row.by}, but it is player ${turn}'s turn`,
			);
		}

		// parseMove and apply both throw on their own, and apply re-checks
		// legality. Wrapped so every failure in here names the move it came from.
		try {
			state = engine.apply(state, engine.parseMove(row.payload));
		} catch (error) {
			throw new Error(
				`corrupt match history: move ${expected} cannot be played: ${(error as Error).message}`,
				{ cause: error },
			);
		}

		outcome = engine.outcome(state);
	}

	return { state, turn: engine.turn(state), outcome, moveNumber: rows.length };
}

/**
 * The two seats of a match, as a Match row holds them. Player 0 moves first.
 *
 * The two ids are assumed distinct. If they are equal, seatOf always answers 0
 * and a win for player 1 cannot be read back; the guard against that belongs in
 * whatever creates matches.
 */
export interface MatchSeats {
	readonly player0Id: string;
	readonly player1Id: string;
}

/** Which seat a user is sitting in, or null if they are only watching. */
export function seatOf(userId: string, seats: MatchSeats): PlayerIndex | null {
	if (userId === seats.player0Id) return 0;
	if (userId === seats.player1Id) return 1;
	return null;
}

/** The user id to store in Match.winnerId. null means a draw. */
export function winnerIdOf(outcome: GameOutcome, seats: MatchSeats): string | null {
	if (outcome.kind === "draw") return null;
	return outcome.player === 0 ? seats.player0Id : seats.player1Id;
}

/**
 * The stored winner read back as an outcome. For finished matches only.
 *
 * On a finished match the stored winner is the authority, not the replayed
 * position: a resignation ends a match with nobody holding five in a row, so
 * the two legitimately disagree. On an active match a null winner means nobody
 * has won yet, and the authority there is replay().outcome instead.
 */
export function outcomeOf(winnerId: string | null, seats: MatchSeats): GameOutcome {
	if (winnerId === null) return { kind: "draw" };

	const seat = seatOf(winnerId, seats);
	if (seat === null) {
		throw new Error(`match winner ${winnerId} is not a player in this match`);
	}

	return { kind: "win", player: seat };
}
