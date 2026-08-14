import type { GameEngine, GameOutcome, PlayerIndex } from "./types.js";

export const BOARD_SIZE = 15;
export const WIN_LENGTH = 5;

/** A square is empty (null) or holds one player's stone. */
export type Cell = PlayerIndex | null;

export interface GomokuMove {
  readonly row: number;
  readonly col: number;
}

export interface GomokuState {
  /** board[row][col]. `readonly` stops accidental mutation at compile time. */
  readonly board: readonly (readonly Cell[])[];
  readonly turn: PlayerIndex;
  readonly lastMove: GomokuMove | null;
  readonly moveCount: number;
}

/**
 * The four axes to check for five in a row: horizontal, vertical, and the two diagonals.
 * Only four, not eight — we count both ways along each axis.
 * `as const` makes this a fixed tuple of literals rather than number[][].
 */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * Creates a BOARD_SIZE x BOARD_SIZE grid with every cell empty (null).
 */
function emptyBoard(): Cell[][] {
  // Array.from calls the callback once per row, so each row is its own array.
  // (Array(N).fill(row) would reuse a single row reference N times.)
  return Array.from({ length: BOARD_SIZE }, () =>
    // fill(null) also converts the sparse holes into real elements.
    Array<Cell>(BOARD_SIZE).fill(null)
  );
}

function countLine(
  board: readonly (readonly Cell[])[],
  row: number,
  col: number,
  dr: number,
  dc: number,
  player: PlayerIndex,
): number {
  let count = 1; // the stone at (row, col) itself

  // Walk outward along +[dr, dc].
  let r = row + dr;
  let c = col + dc;
  while (inBounds(r, c) && board[r][c] === player) {
    count++;
    r += dr;
    c += dc;
  }

  // Walk outward along -[dr, dc].
  r = row - dr;
  c = col - dc;
  while (inBounds(r, c) && board[r][c] === player) {
    count++;
    r -= dr;
    c -= dc;
  }

  return count;
}

export const gomoku: GameEngine<GomokuState, GomokuMove> = {
  name: "gomoku",

  initialState(): GomokuState {
    return {
      board: emptyBoard(),
      turn: 0,
      lastMove: null,
      moveCount: 0,
    };
  },

  turn(state) {
    return state.turn;
  },

  parseMove(input) {
    if (typeof input !== "object" || input === null) {
      throw new Error("move must be an object");
    }
    const { row, col } = input as { row?: unknown; col?: unknown };
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      throw new Error("row and col must be integers");
    }
    return { row: row as number, col: col as number };
  },

  isLegal(state, move) {
    if (gomoku.outcome(state) !== null) return false;   // The game is already over
    if (!inBounds(move.row, move.col)) return false;    // The move is off the board
    return state.board[move.row][move.col] === null;    // True if this cell is empty
  },

  /**
   * TODO: implement.
   * Throw if the move isn't legal. Otherwise return a NEW state:
   *   - board with the stone placed (copy the row you change, keep the others)
   *   - turn flipped to the other player
   *   - lastMove set, moveCount incremented
   *
   * Copying one row and reusing the rest is enough — nothing mutates them.
   */
  apply(state, move) {
    throw new Error("not implemented");
  },

  /**
   * TODO: implement.
   * Every empty square, or an empty list once the game is over.
   */
  legalMoves(state) {
    throw new Error("not implemented");
  },

  /**
   * TODO: implement.
   * Return null if the game is still running.
   *
   * Only the last move can have created a win, so check the four DIRECTIONS
   * through state.lastMove using countLine. Five or more wins — note the
   * winner is the player who just moved, which is NOT state.turn.
   *
   * If nobody won and the board is full, it's a draw.
   */
  outcome(state) {
    throw new Error("not implemented");
  },

  serialize(state) {
    return {
      board: state.board.map((row) => [...row]),
      turn: state.turn,
      lastMove: state.lastMove,
      moveCount: state.moveCount,
    };
  },

  deserialize(input) {
    const s = input as GomokuState;
    if (!Array.isArray(s?.board) || s.board.length !== BOARD_SIZE) {
      throw new Error("invalid gomoku state");
    }
    return s;
  },
};
