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
 * Type guards for `deserialize`.
 *
 * The `value is X` return type is a "type predicate": when one of these returns
 * true, TypeScript narrows the argument from `unknown` to `X` for the rest of
 * the branch. That's what lets deserialize validate and type in a single pass.
 */
function isInteger(value: unknown): value is number {
	return Number.isInteger(value);
}

function isPlayerIndex(value: unknown): value is PlayerIndex {
	return value === 0 || value === 1;
}

function isCell(value: unknown): value is Cell {
	return value === null || isPlayerIndex(value);
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
	// The square itself must hold `player`'s stone, or there is no line through it.
	// apply() guarantees that for lastMove, but a state that arrived through
	// deserialize carries no such guarantee, so check instead of assuming.
	if (!inBounds(row, col) || board[row][col] !== player) return 0;

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
		if (gomoku.outcome(state) !== null)
			return false;   // The game is already over
		if (!inBounds(move.row, move.col))
			return false;    // The move is off the board
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
	 */
	outcome(state) {
		const last = state.lastMove;

		if (last === null)
			return null;           // Nothing was played yet

		const player = state.turn === 0 ? 1 : 0;  // Who just moved - NOT state.turn

		for (const [dr, dc] of DIRECTIONS) {
			if (countLine(state.board, last.row, last.col, dr, dc, player) >= WIN_LENGTH) {
				return {kind: "win", player};
			}
		}

		if (state.moveCount === BOARD_SIZE * BOARD_SIZE)
			return {kind: "draw"};

		return null;
	},

	serialize(state) {
		return {
			board: state.board.map((row) => [...row]),
			turn: state.turn,
			lastMove: state.lastMove === null ? null : { ...state.lastMove },
			moveCount: state.moveCount,
		};
	},

	/**
	 * The second trust boundary, alongside parseMove.
	 *
	 * Input is whatever came back out of the database, so nothing about its shape is guaranteed.
	 * Everything downstream assumes the invariants apply() keeps,
	 * so this rebuilds and rechecks them rather than trusting them.
	 * The state that comes back is freshly built, never the caller's object.
	 */
	deserialize(input) {
		if (typeof input !== "object" || input === null) {
			throw new Error("invalid gomoku state: not an object");
		}
		const { board, turn, lastMove, moveCount } = input as Record<string, unknown>;

		// --- board: BOARD_SIZE rows of BOARD_SIZE cells, each one 0, 1 or null ---
		if (!Array.isArray(board) || board.length !== BOARD_SIZE) {
			throw new Error(`invalid gomoku state: board must have ${BOARD_SIZE} rows`);
		}

		const newBoard: Cell[][] = [];
		for (let r = 0; r < BOARD_SIZE; r++) {
			const row = board[r];
			if (!Array.isArray(row) || row.length !== BOARD_SIZE) {
				throw new Error(`invalid gomoku state: row ${r} must have ${BOARD_SIZE} cells`);
			}

			const newRow: Cell[] = [];
			for (let c = 0; c < BOARD_SIZE; c++) {
				const cell = row[c];
				if (!isCell(cell)) {
					throw new Error(`invalid gomoku state: cell ${r},${c} is not 0, 1 or null`);
				}
				newRow.push(cell);
			}
			newBoard.push(newRow);
		}

		// --- turn and moveCount ---
		if (!isPlayerIndex(turn)) {
			throw new Error("invalid gomoku state: turn must be 0 or 1");
		}
		if (!isInteger(moveCount) || moveCount < 0 || moveCount > BOARD_SIZE * BOARD_SIZE) {
			throw new Error(
				`invalid gomoku state: moveCount must be an integer from 0 to ${BOARD_SIZE * BOARD_SIZE}`,
			);
		}

		// Player 0 moves first and the two alternate,
		// so whose turn it is and how the stones split between them both follow from moveCount alone.
		const cells = newBoard.flat();
		const stones0 = cells.filter((c) => c === 0).length;
		const stones1 = cells.filter((c) => c === 1).length;

		if (turn !== moveCount % 2) {
			throw new Error("invalid gomoku state: turn disagrees with moveCount");
		}
		if (stones0 !== Math.ceil(moveCount / 2) || stones1 !== Math.floor(moveCount / 2)) {
			throw new Error(
				`invalid gomoku state: board holds ${stones0}/${stones1} stones, moveCount says ${moveCount}`,
			);
		}

		// --- lastMove ---
		let newLastMove: GomokuMove | null = null;

		if (moveCount === 0) {
			if (lastMove !== null && lastMove !== undefined) {
				throw new Error("invalid gomoku state: lastMove must be null before the first move");
			}
		} else {
			if (typeof lastMove !== "object" || lastMove === null) {
				throw new Error("invalid gomoku state: lastMove must be set once a move has been played");
			}

			const { row, col } = lastMove as Record<string, unknown>;
			if (!isInteger(row) || !isInteger(col) || !inBounds(row, col)) {
				throw new Error("invalid gomoku state: lastMove is not a square on the board");
			}

			// outcome() treats the square at lastMove as the mover's stone without rechecking it,
			// so a lastMove sitting on an empty gap would let four stones in a row read as a win.
			// Pin that invariant here, where state enters.
			const mover: PlayerIndex = turn === 0 ? 1 : 0;
			if (newBoard[row][col] !== mover) {
				throw new Error("invalid gomoku state: lastMove does not point at the last stone played");
			}
			newLastMove = { row, col };
		}

		return { board: newBoard, turn, lastMove: newLastMove, moveCount };
	},
};
