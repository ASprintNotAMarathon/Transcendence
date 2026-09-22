/**
 * Which engine runs which game.
 *
 * The database stores a game as a name ("gomoku"),
 * so every path from a Match row to a board goes through here.
 */

import { gomoku } from "./gomoku.js";
import type { GameEngine } from "./types.js";

/**
 * An engine with its state and move types erased.
 *
 * The registry cannot know which game a name will resolve to,
 * so it hands back an engine whose state is `unknown`:
 * usable, but only through the engine that produced it.
 * Nothing here stops one game's state reaching another game's apply(),
 * so a state and an engine are only ever paired through Match.game.
 */
export type AnyGameEngine = GameEngine<unknown, unknown>;

/** Mirrors the GameName enum in schema.prisma. Adding a game means editing both. */
export type GameName = "gomoku" | "reversi";

/** Every game the schema knows about, implemented or not. */
export const allGameNames: readonly GameName[] = ["gomoku", "reversi"];

type EngineTable = Partial<Record<GameName, AnyGameEngine>>;

/**
 * Partial, because the schema lists Reversi before the engine exists.
 *
 * `satisfies` is what checks the keys.
 * Object.freeze contextually types its argument by a naked type parameter,
 * which loses the object literal's freshness and with it the excess-property check,
 * so the annotation alone would let a typo'd key compile.
 */
const engines: EngineTable = Object.freeze({ gomoku } satisfies EngineTable);

/** The games that can actually be played today. Derived, so it cannot drift. */
export const implementedGames: readonly GameName[] = allGameNames.filter(
	(name) => engines[name] !== undefined,
);

/** Narrows an untrusted string, from a URL segment or a socket payload, to a GameName. */
export function isGameName(value: unknown): value is GameName {
	return typeof value === "string" && allGameNames.some((name) => name === value);
}

/**
 * The engine for a game, or a throw. Total, so there is no null to forget.
 *
 * Callers read the name from an enum column the server wrote itself, so a miss
 * is a server fault rather than user input. The two failures are told apart by
 * their message because they are different bugs: a match created for a game we
 * cannot run, or a name that is not in the schema at all.
 */
export function getEngine(name: string): AnyGameEngine {
	if (!isGameName(name)) {
		throw new Error(`unknown game: ${name}`);
	}

	const engine = engines[name];
	if (engine === undefined) {
		throw new Error(`game not implemented yet: ${name}`);
	}

	return engine;
}
