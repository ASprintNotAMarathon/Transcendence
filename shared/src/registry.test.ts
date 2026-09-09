import { describe, it, expect } from "vitest";
import { gomoku } from "./gomoku.js";
import { allGameNames, getEngine, implementedGames, isGameName } from "./registry.js";

/**
 * allGameNames is a hand-copy of the GameName enum in schema.prisma, and nothing
 * in the build compares the two. This is the only thing standing between a schema
 * edit and a registry that silently disagrees with the database.
 *
 * The case and whitespace cases in the last test are not padding: a game name can
 * arrive from a socket payload, so isGameName is a trust boundary.
 */
describe("game names", () => {
	it("lists every game in the schema", () => {
		expect(allGameNames).toEqual(["gomoku", "reversi"]);
	});

	it("accepts the names it lists", () => {
		expect(allGameNames.every(isGameName)).toBe(true);
	});

	it("rejects anything else", () => {
		expect(isGameName("chess")).toBe(false);
		expect(isGameName("Gomoku")).toBe(false);
		expect(isGameName(" gomoku")).toBe(false);
		expect(isGameName("")).toBe(false);
		expect(isGameName(null)).toBe(false);
		expect(isGameName(undefined)).toBe(false);
		expect(isGameName(0)).toBe(false);
		expect(isGameName({})).toBe(false);
	});
});


/**
 * getEngine is total and throws, so the two failures have to stay distinguishable
 * by message: a caller that cannot tell "we have not built Reversi yet" from
 * "that is not a game" cannot report either one honestly.
 *
 * The last test is the drift guard. Nothing in the type system checks that an
 * engine is filed under its own name, so an engine registered under the wrong key
 * would compile and then run the wrong game.
 */
describe("engine lookup", () => {
	it("returns the gomoku engine", () => {
		expect(getEngine("gomoku")).toBe(gomoku);
	});

	it("throws for a game with no engine yet", () => {
		expect(() => getEngine("reversi")).toThrow(/not implemented yet/);
	});

	it("throws for a name that is not a game", () => {
		expect(() => getEngine("chess")).toThrow(/unknown game/);
	});

	it("reports only the games it can resolve", () => {
		expect(implementedGames).toEqual(["gomoku"]);
		for (const name of implementedGames) {
			expect(allGameNames).toContain(name);
			expect(() => getEngine(name)).not.toThrow();
		}
	});

	it("keys every engine under its own name", () => {
		for (const name of implementedGames) {
			expect(getEngine(name).name).toBe(name);
		}
	});
});
