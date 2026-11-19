import { Logger } from '@nestjs/common';
import type { LiveMatch, MatchMovedPayload } from '@transcendence/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsDispatcher } from '../ws/ws.dispatch';
import type { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { MatchLobby } from './match.lobby';
import type { MatchService } from './match.service';

const MATCH_ID = 'match-uuid';

const live: LiveMatch = {
	matchId: MATCH_ID,
	game: 'gomoku',
	players: [
		{ userId: 'alice', displayName: 'alice' },
		{ userId: 'bob', displayName: 'bob' },
	],
	turn: 0,
	moveNumber: 0,
	startedAt: '2026-11-16T00:00:00.000Z',
};

const moved: MatchMovedPayload = {
	matchId: MATCH_ID,
	moveNumber: 3,
	by: 0,
	move: { row: 7, col: 7 },
	turn: 1,
	outcome: null,
};

describe('MatchLobby', () => {
	let service: { liveMatch: ReturnType<typeof vi.fn> };
	let sender: {
		broadcast: ReturnType<typeof vi.fn>;
		sendToSocket: ReturnType<typeof vi.fn>;
	};
	let lobby: MatchLobby;

	beforeEach(() => {
		service = { liveMatch: vi.fn() };
		sender = { broadcast: vi.fn(), sendToSocket: vi.fn() };
		lobby = new MatchLobby(
			service as unknown as MatchService,
			{ register: vi.fn() } as unknown as WsDispatcher,
			sender as unknown as WsSender,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('claims lobby.join and lobby.leave, and nothing else', () => {
		const register = vi.fn();
		const withSpy = new MatchLobby(
			service as unknown as MatchService,
			{ register } as unknown as WsDispatcher,
			sender as unknown as WsSender,
		);

		withSpy.onModuleInit();

		expect(register.mock.calls).toEqual([
			['lobby.join', withSpy.join],
			['lobby.leave', withSpy.leave],
		]);
	});

	it('joins and leaves the lobby room', async () => {
		const client = { join: vi.fn(), leave: vi.fn() };
		const socket = client as unknown as WsSocket;

		await lobby.join(socket, { type: 'lobby.join', payload: {} });
		await lobby.leave(socket, { type: 'lobby.leave', payload: {} });

		expect(client.join).toHaveBeenCalledWith('lobby');
		expect(client.leave).toHaveBeenCalledWith('lobby');
	});

	it('confirms the join to that socket only once it is in the room', async () => {
		const client = {
			join: vi.fn(() => {
				expect(sender.sendToSocket).not.toHaveBeenCalled();
			}),
		};
		const socket = client as unknown as WsSocket;

		await lobby.join(socket, {
			type: 'lobby.join',
			cid: 'c1',
			payload: {},
		});

		expect(sender.sendToSocket).toHaveBeenCalledExactlyOnceWith(socket, {
			type: 'lobby.joined',
			cid: 'c1',
			payload: {},
		});
		expect(sender.broadcast).not.toHaveBeenCalled();
	});

	describe('started', () => {
		it('announces the new match as the lobby lists it', async () => {
			service.liveMatch.mockResolvedValue(live);

			await lobby.started(MATCH_ID);

			expect(service.liveMatch).toHaveBeenCalledWith(MATCH_ID);
			expect(sender.broadcast).toHaveBeenCalledExactlyOnceWith('lobby', {
				type: 'lobby.started',
				payload: live,
			});
		});

		it('says nothing when the match is no longer live', async () => {
			service.liveMatch.mockResolvedValue(null);

			await lobby.started(MATCH_ID);

			expect(sender.broadcast).not.toHaveBeenCalled();
		});

		it('logs a failed lookup instead of throwing', async () => {
			const logged = vi
				.spyOn(Logger.prototype, 'error')
				.mockImplementation(() => undefined);
			service.liveMatch.mockRejectedValue(new Error('db is down'));

			await expect(lobby.started(MATCH_ID)).resolves.toBeUndefined();

			expect(logged).toHaveBeenCalledOnce();
			expect(sender.broadcast).not.toHaveBeenCalled();
		});
	});

	describe('moved', () => {
		it('sends only what a lobby row shows', () => {
			lobby.moved(moved);

			expect(sender.broadcast).toHaveBeenCalledExactlyOnceWith('lobby', {
				type: 'lobby.moved',
				payload: { matchId: MATCH_ID, moveNumber: 3, turn: 1 },
			});
		});

		it('sends lobby.ended instead when the move ended the match', () => {
			lobby.moved({ ...moved, outcome: { kind: 'win', player: 0 } });

			expect(sender.broadcast).toHaveBeenCalledExactlyOnceWith('lobby', {
				type: 'lobby.ended',
				payload: { matchId: MATCH_ID },
			});
		});
	});

	it('announces an ended match', () => {
		lobby.ended(MATCH_ID);

		expect(sender.broadcast).toHaveBeenCalledExactlyOnceWith('lobby', {
			type: 'lobby.ended',
			payload: { matchId: MATCH_ID },
		});
	});
});
