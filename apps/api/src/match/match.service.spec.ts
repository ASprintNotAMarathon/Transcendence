import { Test } from '@nestjs/testing';
import { allGameNames, gomoku } from '@transcendence/shared';
import type { GomokuMove } from '@transcendence/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameName } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { MatchError } from './match.error';
import { MatchService } from './match.service';

const PLAYER_0 = { id: 'player-0-uuid', displayName: 'lisandro' };
const PLAYER_1 = { id: 'player-1-uuid', displayName: 'kimia' };
const SPECTATOR_ID = 'spectator-uuid';
const MATCH_ID = 'match-uuid';

type MoveRow = { moveNumber: number; by: number; payload: unknown };

/**
 * Turn a list of moves into the rows the database would be holding for them.
 * Numbered from 1 and alternating seats, which is the only history the schema's
 * constraints and replay() between them will accept.
 */
function rowsFor(moves: GomokuMove[]): MoveRow[] {
	return moves.map((move, index) => ({
		moveNumber: index + 1,
		by: index % 2,
		payload: { ...move },
	}));
}

/** Two harmless moves in the centre. Nobody is close to winning. */
const quietMoves: GomokuMove[] = [
	{ row: 7, col: 7 },
	{ row: 7, col: 8 },
];

/** Five in a row along the top for player 0, player 1 answering far away. */
const winningMoves: GomokuMove[] = [
	{ row: 0, col: 0 },
	{ row: 14, col: 0 },
	{ row: 0, col: 1 },
	{ row: 14, col: 1 },
	{ row: 0, col: 2 },
	{ row: 14, col: 2 },
	{ row: 0, col: 3 },
	{ row: 14, col: 3 },
	{ row: 0, col: 4 },
];

function matchRow(overrides: Record<string, unknown> = {}) {
	return {
		id: MATCH_ID,
		game: 'gomoku',
		status: 'active',
		player0Id: PLAYER_0.id,
		player1Id: PLAYER_1.id,
		winnerId: null as string | null,
		player0: PLAYER_0,
		player1: PLAYER_1,
		moves: [] as MoveRow[],
		...overrides,
	};
}

describe('MatchService.join', () => {
	let service: MatchService;
	let findUnique: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		findUnique = vi.fn();

		const moduleRef = await Test.createTestingModule({
			providers: [
				MatchService,
				{
					provide: PrismaService,
					useValue: { match: { findUnique } },
				},
			],
		}).compile();

		service = moduleRef.get(MatchService);
	});

	it('gives an empty board and player 0 to move for a match with no moves', async () => {
		findUnique.mockResolvedValue(matchRow());

		const state = await service.join(PLAYER_0.id, MATCH_ID);

		expect(state.matchId).toBe(MATCH_ID);
		expect(state.game).toBe('gomoku');
		expect(state.turn).toBe(0);
		expect(state.moveNumber).toBe(0);
		expect(state.outcome).toBeNull();
	});

	it('replays the stored moves into the current position', async () => {
		findUnique.mockResolvedValue(matchRow({ moves: rowsFor(quietMoves) }));

		const state = await service.join(PLAYER_0.id, MATCH_ID);
		const board = gomoku.deserialize(state.state);

		expect(state.moveNumber).toBe(2);
		expect(state.turn).toBe(0);
		expect(board.board[7][7]).toBe(0);
		expect(board.board[7][8]).toBe(1);
	});

	it('puts the engine serialize output on the wire', async () => {
		findUnique.mockResolvedValue(matchRow({ moves: rowsFor(quietMoves) }));

		const state = await service.join(PLAYER_0.id, MATCH_ID);

		// deserialize re-validates the whole shape and throws on anything it did
		// not produce, so surviving it is the real assertion here. Surviving a
		// JSON round trip proves it is also sendable down a socket.
		expect(() => gomoku.deserialize(state.state)).not.toThrow();
		expect(JSON.parse(JSON.stringify(state.state))).toEqual(state.state);
	});

	it('lists the players in seat order', async () => {
		findUnique.mockResolvedValue(matchRow());

		const state = await service.join(PLAYER_0.id, MATCH_ID);

		expect(state.players).toEqual([
			{ userId: PLAYER_0.id, displayName: PLAYER_0.displayName },
			{ userId: PLAYER_1.id, displayName: PLAYER_1.displayName },
		]);
	});

	it('gives a rejoin exactly what it gave the first join', async () => {
		findUnique.mockResolvedValue(matchRow({ moves: rowsFor(quietMoves) }));

		const first = await service.join(PLAYER_0.id, MATCH_ID);
		const second = await service.join(PLAYER_0.id, MATCH_ID);

		// The acceptance criterion in #22, and it costs nothing: there is no
		// first-join path and no rejoin path, only a fold over the same rows.
		expect(second).toEqual(first);
	});

	it('gives a spectator the same payload as a player', async () => {
		findUnique.mockResolvedValue(matchRow({ moves: rowsFor(quietMoves) }));

		const asPlayer = await service.join(PLAYER_0.id, MATCH_ID);
		const asSpectator = await service.join(SPECTATOR_ID, MATCH_ID);

		expect(asSpectator).toEqual(asPlayer);
	});

	it('rejects an unknown match with match.not_found', async () => {
		findUnique.mockResolvedValue(null);

		await expect(service.join(PLAYER_0.id, 'nope')).rejects.toBeInstanceOf(
			MatchError,
		);
		await expect(service.join(PLAYER_0.id, 'nope')).rejects.toMatchObject({
			code: 'match.not_found',
		});
	});

	it('asks the database for the moves in move-number order', async () => {
		findUnique.mockResolvedValue(matchRow());

		await service.join(PLAYER_0.id, MATCH_ID);

		// replay() refuses an out-of-sequence row rather than sorting it, so this
		// clause is the only thing standing between a correct board and a
		// plausible wrong one. Assert the query, not just the result.
		const [args] = findUnique.mock.calls[0] as [
			{ select: { moves: { orderBy: unknown } } },
		];
		expect(args.select.moves.orderBy).toEqual({ moveNumber: 'asc' });
	});

	it('trusts the stored winner on a finished match, not the board', async () => {
		// Two quiet moves: nobody has five in a row. Player 1 still won, because
		// player 0 resigned. The board and the record legitimately disagree.
		findUnique.mockResolvedValue(
			matchRow({
				moves: rowsFor(quietMoves),
				status: 'finished',
				winnerId: PLAYER_1.id,
			}),
		);

		const state = await service.join(PLAYER_0.id, MATCH_ID);

		expect(state.outcome).toEqual({ kind: 'win', player: 1 });
	});

	it('reads a null winner on a finished match as a draw', async () => {
		findUnique.mockResolvedValue(
			matchRow({
				moves: rowsFor(quietMoves),
				status: 'finished',
				winnerId: null,
			}),
		);

		const state = await service.join(PLAYER_0.id, MATCH_ID);

		expect(state.outcome).toEqual({ kind: 'draw' });
	});

	it('reports a win the board shows while the match is still active', async () => {
		findUnique.mockResolvedValue(
			matchRow({ moves: rowsFor(winningMoves) }),
		);

		const state = await service.join(PLAYER_0.id, MATCH_ID);

		expect(state.outcome).toEqual({ kind: 'win', player: 0 });
		expect(state.moveNumber).toBe(winningMoves.length);
	});

	it('fails loudly, and not as a MatchError, for a game with no engine', async () => {
		findUnique.mockResolvedValue(matchRow({ game: 'reversi' }));

		// A match created for a game this server cannot run is a bug on our side.
		// It must reach the player as a 500, never as a rejection code they could
		// be expected to do something about.
		await expect(service.join(PLAYER_0.id, MATCH_ID)).rejects.toThrow(
			/not implemented/,
		);
		await expect(
			service.join(PLAYER_0.id, MATCH_ID),
		).rejects.not.toBeInstanceOf(MatchError);
	});
});

describe('the game names', () => {
	it('agree with the GameName enum in schema.prisma', () => {
		// shared/ declares its own union because it must stay free of Prisma, so
		// the two lists are written twice and nothing links them. This is the
		// only place they can be compared, which makes it the only thing that
		// catches a game added to one side and forgotten on the other.
		expect(Object.keys(GameName).sort()).toEqual([...allGameNames].sort());
	});
});
