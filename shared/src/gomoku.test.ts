import { describe, it, expect } from "vitest";
import { BOARD_SIZE, gomoku, type Cell, type GomokuMove, type GomokuState } from "./gomoku.js";

/** Play a list of moves in order, alternating players automatically. */
function play(moves: GomokuMove[], from = gomoku.initialState()): GomokuState {
	return moves.reduce((state, move) => gomoku.apply(state, move), from);
}

/**
 * Build an alternating sequence where player 0 gets `run` stones along one axis
 * and player 1 plays harmlessly far away on the bottom row.
 */
function runFor(player0: GomokuMove[]): GomokuMove[] {
	const moves: GomokuMove[] = [];
	player0.forEach((m, i) => {
		moves.push(m);
		if (i < player0.length - 1) moves.push({ row: BOARD_SIZE - 1, col: i });
	});
	return moves;
}


/**
 * This test pins down that the initial state is an empty board, player 0 to move, no outcome yet.
 * The second test ("gives a fresh board each time") ,and it is the sneaky one:
 * it applies a move, then checks a newly created initial state is still empty at [7][7].
 * This catches the classic bug where initialState returns a shared module-level object, so game 2 inherits game 1's stones.
 */
describe("initial state", () => {
	it("is empty, player 0 to move", () => {
		const s = gomoku.initialState();
		expect(s.turn).toBe(0);
		expect(s.moveCount).toBe(0);
		expect(s.lastMove).toBeNull();
		expect(s.board.every((row) => row.every((c) => c === null))).toBe(true);
		expect(gomoku.outcome(s)).toBeNull();
	});

	it("gives a fresh board each time", () => {
		const a = gomoku.apply(gomoku.initialState(), { row: 7, col: 7 });
		expect(gomoku.initialState().board[7][7]).toBeNull();
		expect(a.board[7][7]).toBe(0);
	});
});


/**
 * This test pins down the three conditions your isLegal needs:
 * square empty,
 * square on the board,
 * game not over.
 * Plus: apply must throw on an illegal move, not silently ignore it.
 */
describe("legality", () => {
	it("accepts an empty square", () => {
		expect(gomoku.isLegal(gomoku.initialState(), { row: 7, col: 7 })).toBe(true);
	});

	it("rejects an occupied square", () => {
		const s = gomoku.apply(gomoku.initialState(), { row: 7, col: 7 });
		expect(gomoku.isLegal(s, { row: 7, col: 7 })).toBe(false);
	});

	it("rejects off-board squares", () => {
		const s = gomoku.initialState();
		expect(gomoku.isLegal(s, { row: -1, col: 0 })).toBe(false);
		expect(gomoku.isLegal(s, { row: 0, col: BOARD_SIZE })).toBe(false);
	});

	it("throws when applying an illegal move", () => {
		const s = gomoku.apply(gomoku.initialState(), { row: 7, col: 7 });
		expect(() => gomoku.apply(s, { row: 7, col: 7 })).toThrow();
	});
});


/**
 * This test pins down immutability (before.board[3][3] still null after the move) and turn alternation.
 * Note s.turn is 0 after two moves — it flipped twice.
 */
describe("apply", () => {
	it("does not mutate the previous state", () => {
		const before = gomoku.initialState();
		const after = gomoku.apply(before, { row: 3, col: 3 });
		expect(before.board[3][3]).toBeNull();
		expect(after.board[3][3]).toBe(0);
		expect(before.moveCount).toBe(0);
	});

	it("alternates turns", () => {
		const s = play([
			{ row: 0, col: 0 },
			{ row: 1, col: 0 },
		]);
		expect(s.board[0][0]).toBe(0);
		expect(s.board[1][0]).toBe(1);
		expect(s.turn).toBe(0);
		expect(s.moveCount).toBe(2);
	});
});


/**
 * Four directions: horizontal, vertical, and both diagonals.
 * "middle outwards" places columns 3, 4, 6, 7 then fills the gap at 5. This forces countLine to walk in both directions from the new stone — an implementation that only scans forward fails here.
 * "does not win on four" — the off-by-one guard.
 * "does not count a run broken by an opponent stone" — player 1 sits on (7,5) early, so player 0's stones at 3, 4, 6, 7 never form five.
 * "lets player 1 win too" — player 0 plays (0,0) through (0,3) and then deliberately wanders off to (14,14) instead of completing their own five, letting player 1 finish on row 5. Worth reading the move list carefully; it's easy to misread as player 0 winning.
 * "allows no further moves once won" — once someone wins, isLegal is false everywhere and legalMoves is empty. This is why isLegal has to consult outcome.
 */
describe("win detection", () => {
	it("finds five horizontally", () => {
		const s = play(
			runFor([
				{ row: 7, col: 3 },
				{ row: 7, col: 4 },
				{ row: 7, col: 5 },
				{ row: 7, col: 6 },
				{ row: 7, col: 7 },
			]),
		);
		expect(gomoku.outcome(s)).toEqual({ kind: "win", player: 0 });
	});

	it("finds five vertically", () => {
		const s = play(
			runFor([
				{ row: 2, col: 4 },
				{ row: 3, col: 4 },
				{ row: 4, col: 4 },
				{ row: 5, col: 4 },
				{ row: 6, col: 4 },
			]),
		);
		expect(gomoku.outcome(s)).toEqual({ kind: "win", player: 0 });
	});

	it("finds five on a down-right diagonal", () => {
		const s = play(
			runFor([
				{ row: 2, col: 2 },
				{ row: 3, col: 3 },
				{ row: 4, col: 4 },
				{ row: 5, col: 5 },
				{ row: 6, col: 6 },
			]),
		);
		expect(gomoku.outcome(s)).toEqual({ kind: "win", player: 0 });
	});

	it("finds five on a down-left diagonal", () => {
		const s = play(
			runFor([
				{ row: 2, col: 8 },
				{ row: 3, col: 7 },
				{ row: 4, col: 6 },
				{ row: 5, col: 5 },
				{ row: 6, col: 4 },
			]),
		);
		expect(gomoku.outcome(s)).toEqual({ kind: "win", player: 0 });
	});

	it("counts a run built from the middle outwards", () => {
		// Placing the last stone in a gap should still be found.
		const s = play(
			runFor([
				{ row: 7, col: 3 },
				{ row: 7, col: 4 },
				{ row: 7, col: 6 },
				{ row: 7, col: 7 },
				{ row: 7, col: 5 },
			]),
		);
		expect(gomoku.outcome(s)).toEqual({ kind: "win", player: 0 });
	});

	it("does not win on four", () => {
		const s = play(
			runFor([
				{ row: 7, col: 3 },
				{ row: 7, col: 4 },
				{ row: 7, col: 5 },
				{ row: 7, col: 6 },
			]),
		);
		expect(gomoku.outcome(s)).toBeNull();
	});

	it("does not count a run broken by an opponent stone", () => {
		const s = play([
			{ row: 7, col: 3 },
			{ row: 7, col: 5 },
			{ row: 7, col: 4 },
			{ row: 0, col: 0 },
			{ row: 7, col: 6 },
			{ row: 0, col: 1 },
			{ row: 7, col: 7 },
		]);
		expect(gomoku.outcome(s)).toBeNull();
	});

	it("lets player 1 win too", () => {
		const s = play([
			{ row: 0, col: 0 },
			{ row: 5, col: 1 },
			{ row: 0, col: 1 },
			{ row: 5, col: 2 },
			{ row: 0, col: 2 },
			{ row: 5, col: 3 },
			{ row: 0, col: 3 },
			{ row: 5, col: 4 },
			{ row: 14, col: 14 },
			{ row: 5, col: 5 },
		]);
		expect(gomoku.outcome(s)).toEqual({ kind: "win", player: 1 });
	});

	it("allows no further moves once won", () => {
		const s = play(
			runFor([
				{ row: 7, col: 3 },
				{ row: 7, col: 4 },
				{ row: 7, col: 5 },
				{ row: 7, col: 6 },
				{ row: 7, col: 7 },
			]),
		);
		expect(gomoku.isLegal(s, { row: 0, col: 0 })).toBe(false);
		expect(gomoku.legalMoves(s)).toHaveLength(0);
	});
});

describe("legalMoves", () => {
	it("lists every empty square", () => {
		expect(gomoku.legalMoves(gomoku.initialState())).toHaveLength(
			BOARD_SIZE * BOARD_SIZE,
		);
		const s = gomoku.apply(gomoku.initialState(), { row: 7, col: 7 });
		expect(gomoku.legalMoves(s)).toHaveLength(BOARD_SIZE * BOARD_SIZE - 1);
	});
});

/**
 * JSON.parse(JSON.stringify(...)) simulates a database round trip.
 * If serialize returned something JSON can't represent (a Map, a Set, undefined),
 * it'd survive the direct call but break here.
 */
describe("serialization", () => {
	it("survives a JSON round trip", () => {
		const s = play([
			{ row: 7, col: 7 },
			{ row: 8, col: 8 },
		]);
		const back = gomoku.deserialize(JSON.parse(JSON.stringify(gomoku.serialize(s))));
		expect(back.board[7][7]).toBe(0);
		expect(back.board[8][8]).toBe(1);
		expect(back.turn).toBe(s.turn);
		expect(back.moveCount).toBe(2);
	});

	/**
	 * serialize deep-copies the board, so the payload has to be fully detached.
	 * Returning lastMove by reference would leave one object shared between the
	 * payload and the state, and mutating the payload before persisting would
	 * reach back into the state it came from.
	 * The round trip above passes either way, so this needs its own test.
	 */
	it("detaches lastMove from the state it serialized", () => {
		const s = play([{ row: 7, col: 7 }]);
		const payload = gomoku.serialize(s) as { lastMove: GomokuMove | null };

		expect(payload.lastMove).toEqual({ row: 7, col: 7 }); // same value
		expect(payload.lastMove).not.toBe(s.lastMove);        // different object
	});
});

/**
 * Eight legal moves that leave player 1 holding four in a row at row 7, cols 1-4,
 * with player 0 playing harmlessly along row 0. Afterwards it is player 0 to move,
 * so outcome() reads player 1 as the one who just moved.
 *
 * Move lastMove onto the empty square at (7,0) and the run reads as five: four real
 * stones plus the empty square outcome() would have taken on trust.
 */
const fourInARowForPlayer1 = play([
	{ row: 0, col: 0 }, { row: 7, col: 1 },
	{ row: 0, col: 1 }, { row: 7, col: 2 },
	{ row: 0, col: 2 }, { row: 7, col: 3 },
	{ row: 0, col: 3 }, { row: 7, col: 4 },
]);

/**
 * deserialize is a trust boundary, like parseMove: the input is whatever came back
 * out of the database, so a malformed state has to be rejected rather than played on.
 * Every invariant apply() maintains is one that something downstream relies on.
 */
describe("deserialize validation", () => {
	/** A valid payload, with `overrides` merged in so each test corrupts exactly one thing. */
	function payload(state: GomokuState, overrides: Record<string, unknown> = {}): Record<string, unknown> {
		return { ...(gomoku.serialize(state) as Record<string, unknown>), ...overrides };
	}

	/** A grid of nulls typed loosely, so a test can put something illegal in it. */
	function blankBoard(): unknown[][] {
		return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
	}

	it("accepts a genuine serialized state", () => {
		const s = play([{ row: 7, col: 7 }, { row: 8, col: 8 }]);
		expect(() => gomoku.deserialize(payload(s))).not.toThrow();
	});

	it("rejects a board with the wrong number of rows", () => {
		const bad = payload(gomoku.initialState(), { board: [] });
		expect(() => gomoku.deserialize(bad)).toThrow(/board must have 15 rows/);
	});

	it("rejects rows that are not rows", () => {
		// 15 numbers rather than 15 arrays: the old length-only check let this through.
		const bad = payload(gomoku.initialState(), { board: Array(BOARD_SIZE).fill(0) });
		expect(() => gomoku.deserialize(bad)).toThrow(/must have 15 cells/);
	});

	it("rejects a cell that is not 0, 1 or null", () => {
		const board = blankBoard();
		board[3][4] = "x";
		expect(() => gomoku.deserialize(payload(gomoku.initialState(), { board }))).toThrow(
			/cell 3,4 is not 0, 1 or null/,
		);
	});

	it("rejects a turn that disagrees with moveCount", () => {
		// One move played, so it must be player 1 to move.
		const bad = payload(play([{ row: 7, col: 7 }]), { turn: 0 });
		expect(() => gomoku.deserialize(bad)).toThrow(/turn disagrees with moveCount/);
	});

	it("rejects stone counts that disagree with moveCount", () => {
		// One stone on the board, but the state claims three moves were played.
		const bad = payload(play([{ row: 7, col: 7 }]), { moveCount: 3 });
		expect(() => gomoku.deserialize(bad)).toThrow(/stones, moveCount says 3/);
	});

	it("rejects a lastMove off the board", () => {
		const bad = payload(play([{ row: 7, col: 7 }]), { lastMove: { row: 99, col: 0 } });
		expect(() => gomoku.deserialize(bad)).toThrow(/not a square on the board/);
	});

	it("rejects a lastMove pointing at an empty square", () => {
		// Everything else stays consistent: 8 moves, player 0 to move, 4 stones each.
		// Only lastMove moves, onto the gap at the end of player 1's run.
		const bad = payload(fourInARowForPlayer1, { lastMove: { row: 7, col: 0 } });
		expect(() => gomoku.deserialize(bad)).toThrow(/does not point at the last stone played/);
	});

	it("returns a state detached from the input", () => {
		const p = payload(play([{ row: 7, col: 7 }]));
		const s = gomoku.deserialize(p);

		(p.board as Cell[][])[7][7] = null;
		(p.lastMove as { row: number }).row = 0;

		expect(s.board[7][7]).toBe(0);
		expect(s.lastMove).toEqual({ row: 7, col: 7 });
	});
});

/**
 * The validation above is the first line of defence, but countLine used to assume
 * the square at lastMove held the mover's stone. apply() guarantees that; a state
 * built any other way does not. This checks the assumption is no longer made, so a
 * forged state reaching outcome() by some other route still cannot win on a gap.
 */
describe("outcome does not trust lastMove blindly", () => {
	it("does not count an empty square at lastMove as a stone", () => {
		const forged: GomokuState = {
			...fourInARowForPlayer1,
			lastMove: { row: 7, col: 0 }, // empty, immediately left of player 1's four
		};
		expect(forged.board[7][0]).toBeNull();
		expect(gomoku.outcome(forged)).toBeNull();
	});
});
