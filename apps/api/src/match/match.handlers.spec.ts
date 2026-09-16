import type {
	MatchMovePayload,
	MatchMovedPayload,
	MatchStatePayload,
} from '@transcendence/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsDispatcher } from '../ws/ws.dispatch';
import type { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { MatchError } from './match.error';
import { MatchHandlers } from './match.handlers';
import type { MatchService } from './match.service';

const USER_ID = 'socket-user-uuid';
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

describe('MatchHandlers', () => {
	let service: {
		join: ReturnType<typeof vi.fn>;
		move: ReturnType<typeof vi.fn>;
	};
	let sender: {
		broadcast: ReturnType<typeof vi.fn>;
		sendToSocket: ReturnType<typeof vi.fn>;
	};
	let joinRoom: ReturnType<typeof vi.fn>;
	let leaveRoom: ReturnType<typeof vi.fn>;
	let client: WsSocket;
	let handlers: MatchHandlers;

	beforeEach(() => {
		service = { join: vi.fn(), move: vi.fn() };
		sender = { broadcast: vi.fn(), sendToSocket: vi.fn() };
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
		);
	});

	it('claims join, move and leave, and nothing else', () => {
		const register = vi.fn();
		const withSpy = new MatchHandlers(
			service as unknown as MatchService,
			{ register } as unknown as WsDispatcher,
			sender as unknown as WsSender,
		);

		withSpy.onModuleInit();

		expect(register.mock.calls).toEqual([
			['match.join', withSpy.join],
			['match.move', withSpy.move],
			['match.leave', withSpy.leave],
		]);
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
});
