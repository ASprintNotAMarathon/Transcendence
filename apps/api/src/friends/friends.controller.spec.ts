import { Logger, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsSender } from '../ws/ws.sender';
import { FriendsController } from './friends.controller';
import type { FriendsService } from './friends.service';

const ME = { id: 'me-uuid' };
const OTHER = 'other-uuid';
const REQUEST_ID = 'request-uuid';

const changed = { type: 'friends.changed', payload: {} };

describe('FriendsController', () => {
	let friends: {
		sendRequest: ReturnType<typeof vi.fn>;
		accept: ReturnType<typeof vi.fn>;
		decline: ReturnType<typeof vi.fn>;
		remove: ReturnType<typeof vi.fn>;
	};
	let sender: { sendToUser: ReturnType<typeof vi.fn> };
	let controller: FriendsController;

	beforeEach(() => {
		friends = {
			sendRequest: vi.fn().mockResolvedValue('requested'),
			accept: vi.fn().mockResolvedValue(OTHER),
			decline: vi.fn().mockResolvedValue(OTHER),
			remove: vi.fn().mockResolvedValue(undefined),
		};
		sender = { sendToUser: vi.fn() };
		controller = new FriendsController(
			friends as unknown as FriendsService,
			sender as unknown as WsSender,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function toldBoth() {
		expect(sender.sendToUser.mock.calls).toEqual([
			[ME.id, changed],
			[OTHER, changed],
		]);
	}

	it('tells both users when a request is sent', async () => {
		expect(await controller.send(ME, { userId: OTHER })).toEqual({
			friendship: 'requested',
		});
		toldBoth();
	});

	it('tells both users when a request is accepted', async () => {
		await controller.accept(ME, REQUEST_ID);
		toldBoth();
	});

	it('tells both users when a request is declined', async () => {
		await controller.decline(ME, REQUEST_ID);
		toldBoth();
	});

	it('tells both users when a friend is removed or a request cancelled', async () => {
		await controller.remove(ME, OTHER);
		toldBoth();
	});

	it('tells nobody when the change was refused', async () => {
		friends.accept.mockRejectedValue(new NotFoundException());

		await expect(controller.accept(ME, REQUEST_ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(sender.sendToUser).not.toHaveBeenCalled();
	});

	it('still succeeds when the socket cannot be reached', async () => {
		const logged = vi
			.spyOn(Logger.prototype, 'error')
			.mockImplementation(() => undefined);
		sender.sendToUser.mockImplementation(() => {
			throw new Error('WsSender used before the gateway bound it');
		});

		await expect(controller.remove(ME, OTHER)).resolves.toBeUndefined();
		expect(logged).toHaveBeenCalledOnce();
	});
});
