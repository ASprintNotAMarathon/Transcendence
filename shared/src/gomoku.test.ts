import { describe, it, expect } from "vitest";
import { BOARD_SIZE, gomoku, type GomokuMove, type GomokuState } from "./gomoku.js";

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

/**
 * 
 */
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
});
