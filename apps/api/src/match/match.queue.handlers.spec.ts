import { Logger } from '@nestjs/common';
import type { GameName } from '@transcendence/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsDispatcher } from '../ws/ws.dispatch';
import type { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { MatchQueue } from './match.queue';
import { MatchQueueHandlers } from './match.queue.handlers';
import type { MatchService } from './match.service';

const MATCH_ID = 'new-match-uuid';
const CID = 'request-3';

type JoinEvent = Parameters<MatchQueueHandlers['join']>[1];
type LeaveEvent = Parameters<MatchQueueHandlers['leave']>[1];

interface FakeClient {
	id: string;
	data: { userId: string };
	disconnected: boolean;
	once: ReturnType<typeof vi.fn>;
}

function fakeClient(userId: string, tab = 1): FakeClient {
	return {
		id: `${userId}-tab-${tab}`,
		data: { userId },
		disconnected: false,
		once: vi.fn(),
	};
}

function asSocket(client: FakeClient): WsSocket {
	return client as unknown as WsSocket;
}

function joinEvent(game: GameName = 'gomoku'): JoinEvent {
	return { type: 'queue.join', cid: CID, payload: { game } };
}

const leaveEvent: LeaveEvent = { type: 'queue.leave', payload: {} };

function rejected(code: string) {
	return { type: 'queue.rejected', cid: CID, payload: { code } };
}

describe('MatchQueueHandlers', () => {
	let service: {
		current: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	let sender: {
		sendToUser: ReturnType<typeof vi.fn>;
		sendToSocket: ReturnType<typeof vi.fn>;
	};
	let queue: MatchQueue;
	let handlers: MatchQueueHandlers;
	let alice: FakeClient;
	let bob: FakeClient;

	beforeEach(() => {
		service = {
			current: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue(MATCH_ID),
		};
		sender = { sendToUser: vi.fn(), sendToSocket: vi.fn() };
		queue = new MatchQueue();
		handlers = new MatchQueueHandlers(
			service as unknown as MatchService,
			queue,
			{ register: vi.fn() } as unknown as WsDispatcher,
			sender as unknown as WsSender,
		);
		alice = fakeClient('alice');
		bob = fakeClient('bob');
		vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('claims queue.join and queue.leave, and nothing else', () => {
		const register = vi.fn();
		const withSpy = new MatchQueueHandlers(
			service as unknown as MatchService,
			queue,
			{ register } as unknown as WsDispatcher,
			sender as unknown as WsSender,
		);

		withSpy.onModuleInit();

		expect(register.mock.calls).toEqual([
			['queue.join', withSpy.join],
			['queue.leave', withSpy.leave],
		]);
	});

	describe('queue.join', () => {
		it('puts the first player in the queue without creating anything', async () => {
			await handlers.join(asSocket(alice), joinEvent());

			expect(service.create).not.toHaveBeenCalled();
			expect(sender.sendToSocket).not.toHaveBeenCalled();
			expect(queue.takeFor('gomoku')).toEqual({
				userId: 'alice',
				game: 'gomoku',
				socketId: 'alice-tab-1',
			});
		});

		it('pairs the second player, with whoever waited longer as player 0', async () => {
			await handlers.join(asSocket(alice), joinEvent());
			await handlers.join(asSocket(bob), joinEvent());

			expect(service.create).toHaveBeenCalledWith(
				'gomoku',
				'alice',
				'bob',
			);
		});

		it('tells every tab of both players about the new match', async () => {
			await handlers.join(asSocket(alice), joinEvent());
			await handlers.join(asSocket(bob), joinEvent());

			const matched = {
				type: 'queue.matched',
				payload: { matchId: MATCH_ID },
			};
			expect(sender.sendToUser.mock.calls).toEqual([
				['alice', matched],
				['bob', matched],
			]);
		});

		it('leaves both players free to queue again once paired', async () => {
			await handlers.join(asSocket(alice), joinEvent());
			await handlers.join(asSocket(bob), joinEvent());

			expect(queue.claim('alice')).toBe(true);
			expect(queue.claim('bob')).toBe(true);
		});

		it('refuses a game that is not implemented with queue.unknown_game', async () => {
			await handlers.join(asSocket(alice), joinEvent('reversi'));

			expect(sender.sendToSocket).toHaveBeenCalledWith(
				alice,
				rejected('queue.unknown_game'),
			);
			expect(service.current).not.toHaveBeenCalled();
		});

		it('refuses a player with a game in progress with queue.in_match', async () => {
			service.current.mockResolvedValue({ matchId: 'old-match' });

			await handlers.join(asSocket(alice), joinEvent());

			expect(sender.sendToSocket).toHaveBeenCalledWith(
				alice,
				rejected('queue.in_match'),
			);
			expect(queue.takeFor('gomoku')).toBeNull();
			expect(queue.claim('alice')).toBe(true);
		});

		it('refuses a player who is already waiting with queue.already_queued', async () => {
			const secondTab = fakeClient('alice', 2);

			await handlers.join(asSocket(alice), joinEvent());
			await handlers.join(asSocket(secondTab), joinEvent());

			expect(sender.sendToSocket).toHaveBeenCalledWith(
				secondTab,
				rejected('queue.already_queued'),
			);
			expect(service.create).not.toHaveBeenCalled();
		});

		it('refuses a second tab that clicks while the first is still being handled', async () => {
			let finishLookup: (match: null) => void = () => {};
			service.current.mockReturnValueOnce(
				new Promise((resolve) => {
					finishLookup = resolve;
				}),
			);
			const secondTab = fakeClient('alice', 2);

			const first = handlers.join(asSocket(alice), joinEvent());
			await handlers.join(asSocket(secondTab), joinEvent());
			finishLookup(null);
			await first;

			expect(sender.sendToSocket).toHaveBeenCalledWith(
				secondTab,
				rejected('queue.already_queued'),
			);
			expect(service.create).not.toHaveBeenCalled();
			expect(queue.takeFor('gomoku')).toEqual(
				expect.objectContaining({ socketId: 'alice-tab-1' }),
			);
			expect(queue.takeFor('gomoku')).toBeNull();
		});

		it('does not queue a tab that closed while its match was being looked up', async () => {
			let finishLookup: (match: null) => void = () => {};
			service.current.mockReturnValueOnce(
				new Promise((resolve) => {
					finishLookup = resolve;
				}),
			);

			const joining = handlers.join(asSocket(alice), joinEvent());
			alice.disconnected = true;
			finishLookup(null);
			await joining;

			expect(queue.takeFor('gomoku')).toBeNull();
			expect(queue.claim('alice')).toBe(true);
		});

		it('sends queue.failed and frees the player when the lookup fails', async () => {
			service.current.mockRejectedValue(new Error('connection lost'));

			await handlers.join(asSocket(alice), joinEvent());

			expect(sender.sendToSocket).toHaveBeenCalledWith(
				alice,
				rejected('queue.failed'),
			);
			expect(queue.claim('alice')).toBe(true);
		});

		it('tells both players and frees them both when the match cannot be created', async () => {
			service.create.mockRejectedValue(new Error('connection lost'));

			await handlers.join(asSocket(alice), joinEvent());
			await handlers.join(asSocket(bob), joinEvent());

			const failed = {
				type: 'queue.rejected',
				payload: { code: 'queue.failed' },
			};
			expect(sender.sendToUser.mock.calls).toEqual([
				['alice', failed],
				['bob', failed],
			]);
			expect(queue.claim('alice')).toBe(true);
			expect(queue.claim('bob')).toBe(true);
		});
	});

	describe('closing a tab', () => {
		function closeTab(client: FakeClient): void {
			const [event, onClose] = client.once.mock.calls[0] as [
				string,
				() => void,
			];
			expect(event).toBe('disconnect');
			onClose();
		}

		it('takes the player out of the queue when the tab that clicked Play closes', async () => {
			await handlers.join(asSocket(alice), joinEvent());

			closeTab(alice);

			expect(queue.takeFor('gomoku')).toBeNull();
		});

		it('listens for the tab closing only once, however often it clicks Play', async () => {
			await handlers.join(asSocket(alice), joinEvent());
			await handlers.leave(asSocket(alice), leaveEvent);
			await handlers.join(asSocket(alice), joinEvent());

			expect(alice.once).toHaveBeenCalledTimes(1);
		});
	});

	describe('queue.leave', () => {
		it('takes the player out of the queue', async () => {
			await handlers.join(asSocket(alice), joinEvent());

			await handlers.leave(asSocket(alice), leaveEvent);

			expect(queue.takeFor('gomoku')).toBeNull();
		});
	});
});
