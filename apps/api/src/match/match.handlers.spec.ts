import { Logger } from '@nestjs/common';
import type {
	LiveMatch,
	MatchEndedPayload,
	MatchMovePayload,
	MatchMovedPayload,
	MatchStatePayload,
} from '@transcendence/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsDispatcher } from '../ws/ws.dispatch';
import type { WsLifecycle } from '../ws/ws.lifecycle';
import { WsRegistry } from '../ws/ws.registry';
import type { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { GRACE_MS, MatchDisconnects } from './match.disconnects';
import { MatchError } from './match.error';
import { MatchHandlers } from './match.handlers';
import type { MatchService } from './match.service';

const USER_ID = 'socket-user-uuid';
const OPPONENT_ID = 'opponent-uuid';
const MATCH_ID = 'match-uuid';
const ROOM = `match:${MATCH_ID}`;
const CID = 'request-7';

/** What the service returns for a join. The handler only passes it along. */
const snapshot = { matchId: MATCH_ID } as MatchStatePayload;

/** What the service returns for an accepted move. Passed along the same way. */
const moved = {
	matchId: MATCH_ID,
	moveNumber: 3,
	by: 0,
	move: { row: 7, col: 7 },
	turn: 1,
	outcome: null,
} as MatchMovedPayload;

const ended: MatchEndedPayload = {
	matchId: MATCH_ID,
	outcome: { kind: 'win', player: 1 },
	reason: 'resigned',
};

const live: LiveMatch = {
	matchId: MATCH_ID,
	game: 'gomoku',
	players: [
		{ userId: USER_ID, displayName: 'alice' },
		{ userId: OPPONENT_ID, displayName: 'bob' },
	],
	turn: 0,
	moveNumber: 0,
	startedAt: '2026-11-09T00:00:00.000Z',
};

describe('MatchHandlers', () => {
	let service: {
		join: ReturnType<typeof vi.fn>;
		move: ReturnType<typeof vi.fn>;
		resign: ReturnType<typeof vi.fn>;
		abandon: ReturnType<typeof vi.fn>;
		current: ReturnType<typeof vi.fn>;
	};
	let sender: {
		broadcast: ReturnType<typeof vi.fn>;
		sendToSocket: ReturnType<typeof vi.fn>;
	};
	let disconnects: MatchDisconnects;
	let lifecycle: {
		onUserOnline: ReturnType<typeof vi.fn>;
		onUserOffline: ReturnType<typeof vi.fn>;
	};
	let registry: WsRegistry;
	let joinRoom: ReturnType<typeof vi.fn>;
	let leaveRoom: ReturnType<typeof vi.fn>;
	let client: WsSocket;
	let handlers: MatchHandlers;

	beforeEach(() => {
		service = {
			join: vi.fn(),
			move: vi.fn(),
			resign: vi.fn(),
			abandon: vi.fn(),
			current: vi.fn(),
		};
		sender = { broadcast: vi.fn(), sendToSocket: vi.fn() };
		disconnects = new MatchDisconnects();
		lifecycle = { onUserOnline: vi.fn(), onUserOffline: vi.fn() };
		registry = new WsRegistry();
		joinRoom = vi.fn();
		leaveRoom = vi.fn();
		client = {
			data: { userId: USER_ID },
			join: joinRoom,
			leave: leaveRoom,
		} as unknown as WsSocket;

		handlers = new MatchHandlers(
			service as unknown as MatchService,
			{ register: vi.fn() } as unknown as WsDispatcher,
			sender as unknown as WsSender,
			disconnects,
			lifecycle as unknown as WsLifecycle,
			registry,
		);
	});

	it('claims join, move, resign and leave, and nothing else', () => {
		const register = vi.fn();
		const withSpy = new MatchHandlers(
			service as unknown as MatchService,
			{ register } as unknown as WsDispatcher,
			sender as unknown as WsSender,
			disconnects,
			lifecycle as unknown as WsLifecycle,
			registry,
		);

		withSpy.onModuleInit();

		expect(register.mock.calls).toEqual([
			['match.join', withSpy.join],
			['match.move', withSpy.move],
			['match.resign', withSpy.resign],
			['match.leave', withSpy.leave],
		]);
		expect(lifecycle.onUserOffline).toHaveBeenCalledWith(
			withSpy.userWentOffline,
		);
		expect(lifecycle.onUserOnline).toHaveBeenCalledWith(
			withSpy.userCameOnline,
		);
	});

	describe('match.move', () => {
		function moveEvent(payload: MatchMovePayload) {
			return { type: 'match.move' as const, cid: CID, payload };
		}

		it('broadcasts an accepted move to the whole room and nothing to the sender alone', async () => {
			service.move.mockResolvedValue(moved);

			await handlers.move(
				client,
				moveEvent({ matchId: MATCH_ID, move: moved.move }),
			);

			expect(sender.broadcast).toHaveBeenCalledOnce();
			expect(sender.broadcast).toHaveBeenCalledWith(ROOM, {
				type: 'match.moved',
				payload: moved,
			});
			expect(sender.sendToSocket).not.toHaveBeenCalled();
		});

		it('plays as the socket user even when the payload names someone else', async () => {
			service.move.mockResolvedValue(moved);
			const payload = {
				matchId: MATCH_ID,
				move: moved.move,
				userId: 'the-opponent-uuid',
			} as MatchMovePayload;

			await handlers.move(client, moveEvent(payload));

			expect(service.move).toHaveBeenCalledWith(USER_ID, payload);
		});

		it('sends a refusal to the sender only, with its cid, and broadcasts nothing', async () => {
			service.move.mockRejectedValue(
				new MatchError('match.not_your_turn'),
			);

			await handlers.move(
				client,
				moveEvent({ matchId: MATCH_ID, move: moved.move }),
			);

			expect(sender.sendToSocket).toHaveBeenCalledOnce();
			expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
				type: 'match.rejected',
				cid: CID,
				payload: { matchId: MATCH_ID, code: 'match.not_your_turn' },
			});
			expect(sender.broadcast).not.toHaveBeenCalled();
		});

		it('rethrows a server fault and tells nobody', async () => {
			const fault = new Error('replay found a gap in the history');
			service.move.mockRejectedValue(fault);

			await expect(
				handlers.move(
					client,
					moveEvent({ matchId: MATCH_ID, move: moved.move }),
				),
			).rejects.toBe(fault);

			expect(sender.sendToSocket).not.toHaveBeenCalled();
			expect(sender.broadcast).not.toHaveBeenCalled();
		});
	});

	describe('match.resign', () => {
		function resignEvent() {
			return {
				type: 'match.resign' as const,
				cid: CID,
				payload: { matchId: MATCH_ID },
			};
		}

		it('broadcasts the end of the match to the whole room', async () => {
			service.resign.mockResolvedValue(ended);

			await handlers.resign(client, resignEvent());

			expect(sender.broadcast).toHaveBeenCalledOnce();
			expect(sender.broadcast).toHaveBeenCalledWith(ROOM, {
				type: 'match.ended',
				payload: ended,
			});
			expect(sender.sendToSocket).not.toHaveBeenCalled();
		});

		it('resigns as the socket user', async () => {
			service.resign.mockResolvedValue(ended);

			await handlers.resign(client, resignEvent());

			expect(service.resign).toHaveBeenCalledWith(USER_ID, MATCH_ID);
		});

		it('sends a refusal to the sender only, with its cid, and broadcasts nothing', async () => {
			service.resign.mockRejectedValue(
				new MatchError('match.already_over'),
			);

			await handlers.resign(client, resignEvent());

			expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
				type: 'match.rejected',
				cid: CID,
				payload: { matchId: MATCH_ID, code: 'match.already_over' },
			});
			expect(sender.broadcast).not.toHaveBeenCalled();
		});

		it('rethrows a server fault and tells nobody', async () => {
			const fault = new Error('database unreachable');
			service.resign.mockRejectedValue(fault);

			await expect(handlers.resign(client, resignEvent())).rejects.toBe(
				fault,
			);

			expect(sender.sendToSocket).not.toHaveBeenCalled();
			expect(sender.broadcast).not.toHaveBeenCalled();
		});
	});

	describe('match.join', () => {
		const joinEvent = {
			type: 'match.join' as const,
			cid: CID,
			payload: { matchId: MATCH_ID },
		};

		it('joins the room before reading the snapshot, then sends it to the socket', async () => {
			service.join.mockResolvedValue(snapshot);

			await handlers.join(client, joinEvent);

			expect(joinRoom).toHaveBeenCalledWith(ROOM);
			expect(service.join).toHaveBeenCalledWith(USER_ID, MATCH_ID);
			expect(joinRoom.mock.invocationCallOrder[0]).toBeLessThan(
				service.join.mock.invocationCallOrder[0],
			);
			expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
				type: 'match.state',
				cid: CID,
				payload: snapshot,
			});
			expect(sender.broadcast).not.toHaveBeenCalled();
			expect(leaveRoom).not.toHaveBeenCalled();
		});

		it('leaves the room again and tells the sender when the join is refused', async () => {
			service.join.mockRejectedValue(new MatchError('match.not_found'));

			await handlers.join(client, joinEvent);

			expect(leaveRoom).toHaveBeenCalledWith(ROOM);
			expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
				type: 'match.rejected',
				cid: CID,
				payload: { matchId: MATCH_ID, code: 'match.not_found' },
			});
			expect(sender.broadcast).not.toHaveBeenCalled();
		});

		it('leaves the room and rethrows a server fault without replying', async () => {
			const fault = new Error('no engine for reversi');
			service.join.mockRejectedValue(fault);

			await expect(handlers.join(client, joinEvent)).rejects.toBe(fault);

			expect(leaveRoom).toHaveBeenCalledWith(ROOM);
			expect(sender.sendToSocket).not.toHaveBeenCalled();
		});
	});

	describe('match.leave', () => {
		it('leaves the room and sends nothing', async () => {
			await handlers.leave(client, {
				type: 'match.leave',
				payload: { matchId: MATCH_ID },
			});

			expect(leaveRoom).toHaveBeenCalledWith(ROOM);
			expect(service.join).not.toHaveBeenCalled();
			expect(service.move).not.toHaveBeenCalled();
			expect(sender.sendToSocket).not.toHaveBeenCalled();
			expect(sender.broadcast).not.toHaveBeenCalled();
		});
	});

	describe('presence', () => {
		const abandoned: MatchEndedPayload = {
			matchId: MATCH_ID,
			outcome: { kind: 'win', player: 1 },
			reason: 'abandoned',
		};

		beforeEach(() => {
			vi.useFakeTimers();
			service.current.mockResolvedValue(live);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('tells the room when a player drops, with the deadline', async () => {
			await handlers.userWentOffline(USER_ID);

			expect(sender.broadcast).toHaveBeenCalledOnce();
			expect(sender.broadcast).toHaveBeenCalledWith(ROOM, {
				type: 'match.disconnected',
				payload: {
					matchId: MATCH_ID,
					player: 0,
					deadline: new Date(Date.now() + GRACE_MS).toISOString(),
				},
			});
		});

		it('works out the seat of the second player', async () => {
			await handlers.userWentOffline(OPPONENT_ID);

			expect(sender.broadcast).toHaveBeenCalledWith(ROOM, {
				type: 'match.disconnected',
				payload: {
					matchId: MATCH_ID,
					player: 1,
					deadline: new Date(Date.now() + GRACE_MS).toISOString(),
				},
			});
		});

		it('does nothing when the user has no live match', async () => {
			service.current.mockResolvedValue(null);

			await handlers.userWentOffline(USER_ID);
			await vi.advanceTimersByTimeAsync(GRACE_MS);

			expect(sender.broadcast).not.toHaveBeenCalled();
			expect(service.abandon).not.toHaveBeenCalled();
		});

		it('starts no timer when the user came back during the lookup', async () => {
			let finishLookup: (match: LiveMatch) => void = () => undefined;
			service.current.mockReturnValue(
				new Promise<LiveMatch>((resolve) => {
					finishLookup = resolve;
				}),
			);

			const dropping = handlers.userWentOffline(USER_ID);
			registry.add(USER_ID, 'new-socket');
			finishLookup(live);
			await dropping;
			await vi.advanceTimersByTimeAsync(GRACE_MS);

			expect(sender.broadcast).not.toHaveBeenCalled();
			expect(service.abandon).not.toHaveBeenCalled();
		});

		it('cancels the timer and tells the room when the player returns', async () => {
			await handlers.userWentOffline(USER_ID);
			sender.broadcast.mockClear();

			handlers.userCameOnline(USER_ID);
			await vi.advanceTimersByTimeAsync(GRACE_MS);

			expect(sender.broadcast).toHaveBeenCalledOnce();
			expect(sender.broadcast).toHaveBeenCalledWith(ROOM, {
				type: 'match.reconnected',
				payload: { matchId: MATCH_ID, player: 0 },
			});
			expect(service.abandon).not.toHaveBeenCalled();
		});

		it('says nothing when a user with no timer comes online', () => {
			handlers.userCameOnline(USER_ID);

			expect(sender.broadcast).not.toHaveBeenCalled();
		});

		it('abandons the match and tells the room when the time runs out', async () => {
			service.abandon.mockResolvedValue(abandoned);
			await handlers.userWentOffline(USER_ID);
			sender.broadcast.mockClear();

			await vi.advanceTimersByTimeAsync(GRACE_MS);

			expect(service.abandon).toHaveBeenCalledWith(USER_ID, MATCH_ID);
			expect(sender.broadcast).toHaveBeenCalledOnce();
			expect(sender.broadcast).toHaveBeenCalledWith(ROOM, {
				type: 'match.ended',
				payload: abandoned,
			});
		});

		it('stays quiet when the match was already over at expiry', async () => {
			service.abandon.mockResolvedValue(null);
			await handlers.userWentOffline(USER_ID);
			sender.broadcast.mockClear();

			await vi.advanceTimersByTimeAsync(GRACE_MS);

			expect(service.abandon).toHaveBeenCalledOnce();
			expect(sender.broadcast).not.toHaveBeenCalled();
		});

		it('logs a failed abandon instead of letting it escape the timer', async () => {
			const logged = vi
				.spyOn(Logger.prototype, 'error')
				.mockImplementation(() => undefined);
			service.abandon.mockRejectedValue(new Error('db is down'));
			await handlers.userWentOffline(USER_ID);
			sender.broadcast.mockClear();

			await vi.advanceTimersByTimeAsync(GRACE_MS);

			expect(logged).toHaveBeenCalledOnce();
			expect(sender.broadcast).not.toHaveBeenCalled();
			logged.mockRestore();
		});
	});
});
