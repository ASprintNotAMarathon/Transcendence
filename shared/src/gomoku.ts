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
   * Throw if the move isn't legal. Otherwise return a NEW state:
   *   - board with the stone placed
   *   - turn flipped to the other player
   *   - lastMove set, moveCount incremented
   */
  apply(state, move) {
    if (!gomoku.isLegal(state, move)) {
      throw new Error(`illegal move: ${move.row}, ${move.col}`);
    }

    // The three dots copy an array. Copy the row that changes, place the stone.
    const newRow = [...state.board[move.row]];
    newRow[move.col] = state.turn; // the stone belongs to whoever's turn it is

    // Copy the outer array too, then point the changed slot at the new row.
    const newBoard = [...state.board];
    newBoard[move.row] = newRow;

    return {
      board: newBoard,
      turn: state.turn === 0 ? 1 : 0,
      lastMove: move,
      moveCount: state.moveCount + 1,
    };
  },

  /**
   * Every empty square, or an empty list once the game is over.
   */
  legalMoves(state) {
    if (gomoku.outcome(state) !== null) return [];

    const moves: GomokuMove[] = [];

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (state.board[row][col] === null) moves.push({ row, col });
      }
    }

    return moves;
  },

  /**
   * Reports the game result implied by the most recent move,
   * or null if play continues.
   *
   * Only lines running through `state.lastMove` are examined.
   * Any winning line must contain the stone that was just placed,
   * so a full-board scan would be redundant — but this makes the check incremental:
   * it must be called after every move, or a win made on a skipped move goes unnoticed.
   *
   * @returns {{kind: "win", player: number} | {kind: "draw"} | null}
   */
  outcome(state) {
    const last = state.lastMove;

    if (last === null) return null;           // Nothing was played yet

    const player = state.turn === 0 ? 1 : 0;  // Who just moved - NOT state.turn

    for (const [dr, dc] of DIRECTIONS) {
      if (countLine(state.board, last.row, last.col, dr, dc, player) >= WIN_LENGTH) {
        return {kind: "win", player};
      }
    }

    if (state.moveCount === BOARD_SIZE * BOARD_SIZE) return {kind: "draw"};

    return null;
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
