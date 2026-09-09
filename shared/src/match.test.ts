import { describe, it, expect } from "vitest";
import { BOARD_SIZE, gomoku, type GomokuMove } from "./gomoku.js";
import { outcomeOf, replay, seatOf, winnerIdOf, type MatchSeats, type MoveRow } from "./match.js";
import { getEngine } from "./registry.js";

/**
 * Copied from gomoku.test.ts rather than shared. tsconfig.build.json excludes
 * only *.test.ts, so a helper module would ship inside dist/, and importing one
 * test file from another makes vitest register the same describes twice.
 *
 * `play` is not copied because replay() is play().
 */
function runFor(player0: GomokuMove[]): GomokuMove[] {
	const moves: GomokuMove[] = [];
	player0.forEach((m, i) => {
		moves.push(m);
		if (i < player0.length - 1) moves.push({ row: BOARD_SIZE - 1, col: i });
	});
	return moves;
}

/** The rows a match would have stored for a list of alternating moves. */
function history(moves: GomokuMove[]): MoveRow[] {
	return moves.map((payload, index) => ({ moveNumber: index + 1, by: index % 2, payload }));
}

/** Nine rows, ending in five in a row along row 7 for player 0. */
const wonByPlayer0 = history(
	runFor([
		{ row: 7, col: 3 },
		{ row: 7, col: 4 },
		{ row: 7, col: 5 },
		{ row: 7, col: 6 },
		{ row: 7, col: 7 },
	]),
);

const seats: MatchSeats = { player0Id: "u0", player1Id: "u1" };


/**
 * The board is not a column, so this function is the only thing that knows what a
 * match looks like. If it drifts, every screen and every socket payload is wrong
 * at once.
 *
 * The win test also pins the incremental outcome: gomoku's outcome() only scans
 * the lines through lastMove, so reading it once after the loop instead of after
 * every move would miss a win played anywhere but last.
 */
describe("replay of a stored history", () => {
	it("returns a fresh board for an empty history", () => {
		const result = replay(gomoku, []);
		expect(result.moveNumber).toBe(0);
		expect(result.turn).toBe(0);
		expect(result.outcome).toBeNull();
		expect(result.state.moveCount).toBe(0);
	});

	it("rebuilds the position move by move", () => {
		const result = replay(gomoku, history([{ row: 7, col: 7 }, { row: 8, col: 8 }]));
		expect(result.state.board[7][7]).toBe(0);
		expect(result.state.board[8][8]).toBe(1);
		expect(result.moveNumber).toBe(2);
		expect(result.turn).toBe(0);
	});

	it("reports a win that the last move produced", () => {
		const result = replay(gomoku, wonByPlayer0);
		expect(result.outcome).toEqual({ kind: "win", player: 0 });
		expect(result.moveNumber).toBe(9);
		expect(result.turn).toBe(1);
	});
});


/**
 * Postgres constrains none of this. `by` is a plain int, rows come back in
 * whatever order the query asked for, and nothing stops a row being written after
 * the match ended. Each case is a different upstream bug, so each gets its own
 * message rather than one catch-all.
 *
 * The "after the game ended" case is the sharp one: that extra row has the right
 * number, a valid mover, the correct turn and an empty target square, so only the
 * outcome check can catch it. Asserting the message is what stops it silently
 * degrading into the engine's own "illegal move".
 */
describe("replay of a corrupt history", () => {
	it("rejects a history that does not start at move 1", () => {
		const rows: MoveRow[] = [{ moveNumber: 2, by: 0, payload: { row: 7, col: 7 } }];
		expect(() => replay(gomoku, rows)).toThrow(/expected move 1, got move 2/);
	});

	it("rejects rows that arrived out of order", () => {
		const rows: MoveRow[] = [
			{ moveNumber: 1, by: 0, payload: { row: 7, col: 7 } },
			{ moveNumber: 3, by: 1, payload: { row: 8, col: 8 } },
			{ moveNumber: 2, by: 0, payload: { row: 9, col: 9 } },
		];
		expect(() => replay(gomoku, rows)).toThrow(/expected move 2, got move 3/);
	});

	it("rejects a mover that is not 0 or 1", () => {
		const two: MoveRow[] = [{ moveNumber: 1, by: 2, payload: { row: 7, col: 7 } }];
		const negative: MoveRow[] = [{ moveNumber: 1, by: -1, payload: { row: 7, col: 7 } }];
		expect(() => replay(gomoku, two)).toThrow(/played by 2, not 0 or 1/);
		expect(() => replay(gomoku, negative)).toThrow(/played by -1, not 0 or 1/);
	});

	it("rejects a move played after the game ended", () => {
		const rows: MoveRow[] = [
			...wonByPlayer0,
			{ moveNumber: 10, by: 1, payload: { row: 0, col: 0 } },
		];
		expect(() => replay(gomoku, rows)).toThrow(/move 10 was played after the game ended/);
	});

	it("rejects a move played out of turn", () => {
		const rows: MoveRow[] = [
			{ moveNumber: 1, by: 0, payload: { row: 7, col: 7 } },
			{ moveNumber: 2, by: 0, payload: { row: 8, col: 8 } },
		];
		expect(() => replay(gomoku, rows)).toThrow(/move 2 was played by 0, but it is player 1's turn/);
	});

	it("rejects a payload that is not a move", () => {
		const rows: MoveRow[] = [{ moveNumber: 1, by: 0, payload: "nope" }];
		expect(() => replay(gomoku, rows)).toThrow(
			/move 1 cannot be played: move must be an object/,
		);
	});

	it("rejects a move onto an occupied square", () => {
		const rows: MoveRow[] = [
			{ moveNumber: 1, by: 0, payload: { row: 7, col: 7 } },
			{ moveNumber: 2, by: 1, payload: { row: 7, col: 7 } },
		];
		expect(() => replay(gomoku, rows)).toThrow(/move 2 cannot be played: illegal move/);
	});
});


/**
 * The API only ever holds a game name, so the registry hands it an engine with its
 * types erased. This is the call site proving that erasure is usable and not
 * merely assignable. Most of the check is done by tsc rather than by the
 * assertions: `result.state` here is `unknown`, and the only way back to a typed
 * board is through the engine that produced it.
 */
describe("replay through an erased engine", () => {
	it("replays a history looked up by name", () => {
		const result = replay(getEngine("gomoku"), wonByPlayer0);
		expect(result.outcome).toEqual({ kind: "win", player: 0 });
		expect(result.moveNumber).toBe(9);
		expect(result.turn).toBe(1);
	});

	it("hands the erased state back to the engine that made it", () => {
		const engine = getEngine("gomoku");
		const result = replay(engine, wonByPlayer0);
		const state = gomoku.deserialize(engine.serialize(result.state));
		expect(state.board[7][7]).toBe(0);
	});
});


/**
 * The winner is stored as a user id and read back as a seat index, so the two
 * representations have to round-trip. This is not decorative: a resignation ends a
 * match with nobody holding five in a row, which is why the stored winner wins
 * over the replayed position on a finished match.
 */
describe("seats", () => {
	it("finds each player's seat", () => {
		expect(seatOf("u0", seats)).toBe(0);
		expect(seatOf("u1", seats)).toBe(1);
	});

	it("returns null for someone who is not playing", () => {
		expect(seatOf("u2", seats)).toBeNull();
	});

	it("names the winner of a win and nobody for a draw", () => {
		expect(winnerIdOf({ kind: "win", player: 0 }, seats)).toBe("u0");
		expect(winnerIdOf({ kind: "win", player: 1 }, seats)).toBe("u1");
		expect(winnerIdOf({ kind: "draw" }, seats)).toBeNull();
	});

	it("reads a stored winner back as a seat", () => {
		expect(outcomeOf("u0", seats)).toEqual({ kind: "win", player: 0 });
		expect(outcomeOf("u1", seats)).toEqual({ kind: "win", player: 1 });
	});

	it("reads a null winner as a draw", () => {
		expect(outcomeOf(null, seats)).toEqual({ kind: "draw" });
	});

	it("throws when the stored winner is not in the match", () => {
		expect(() => outcomeOf("u2", seats)).toThrow(/not a player in this match/);
	});

	it("round-trips every outcome", () => {
		for (const outcome of [
			{ kind: "win", player: 0 },
			{ kind: "win", player: 1 },
			{ kind: "draw" },
		] as const) {
			expect(outcomeOf(winnerIdOf(outcome, seats), seats)).toEqual(outcome);
		}
	});
});
