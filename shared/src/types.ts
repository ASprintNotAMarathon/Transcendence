/**
 * The contract every game in this project implements.
 *
 * Gomoku and Reversi both fit this shape,
 * which is why the second game reuses the match runtime, the WebSocket layer and the database schema.
 *
 * Everything here is pure: no I/O, no logging, no DOM, no Node APIs.
 * This file and its implementations must be importable by both the frontend and backend.
 */

/** There are exactly two players. Player 0 moves first. */
export type PlayerIndex = 0 | 1;

/**
 * How a finished game ended.
 *
 * This is a "discriminated union": a value is one shape OR the other, and the `kind` field tells you which.
 * After `if (o.kind === "win")` TypeScript knows `o.player` exists; in the draw branch it knows it doesn't.
 */
export type GameOutcome =
  | { readonly kind: "win"; readonly player: PlayerIndex }
  | { readonly kind: "draw" };

/**
 * TState and TMove are generics: placeholders each game fills in.
 * Gomoku implements GameEngine<GomokuState, GomokuMove>,
 * so within that implementation TypeScript reads every TState as GomokuState.
 */
export interface GameEngine<TState, TMove> {
  readonly name: string;

  /** A fresh game. Same result every time. */
  initialState(): TState;

  /**
   * Turn untrusted JSON from a client into a move, or throw.
   * This is the only place that accepts `unknown`; everything past it is typed.
   */
  parseMove(input: unknown): TMove;

  /** Whose turn it is. Read from state, never assumed to alternate. */
  turn(state: TState): PlayerIndex;

  /** Every move the current player may legally make. */
  legalMoves(state: TState): readonly TMove[];

  isLegal(state: TState, move: TMove): boolean;

  /**
   * Play a move. MUST NOT mutate `state`; return a new one.
   * Callers rely on old states staying valid.
   */
  apply(state: TState, move: TMove): TState;

  /** null while the game is still running. */
  outcome(state: TState): GameOutcome | null;

  /** For storing in the database.
   * Must survive a JSON round-trip (save it, load it back, check you got the same thing). */
  serialize(state: TState): unknown;    // board object  →  something storable
  deserialize(input: unknown): TState;  // stored thing  →  board object back
}
