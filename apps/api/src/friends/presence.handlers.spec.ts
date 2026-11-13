import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsDispatcher } from '../ws/ws.dispatch';
import type { WsRegistry } from '../ws/ws.registry';
import type { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import type { FriendsService } from './friends.service';
import { PresenceHandlers } from './presence.handlers';

const DANA = 'dana-id';
const CHARLIE = 'charlie-id';
const ALICE = 'alice-id';

describe('PresenceHandlers', () => {
	let friends: {
		listFriends: ReturnType<typeof vi.fn>;
		friendIdsOf: ReturnType<typeof vi.fn>;
		presenceUser: ReturnType<typeof vi.fn>;
	};
	let registry: {
		onChange: ReturnType<typeof vi.fn>;
		isOnline: ReturnType<typeof vi.fn>;
	};
	let dispatcher: { register: ReturnType<typeof vi.fn> };
	let sender: {
		sendToUser: ReturnType<typeof vi.fn>;
		sendToSocket: ReturnType<typeof vi.fn>;
	};
	let handlers: PresenceHandlers;

	beforeEach(() => {
		// Fakes for everything around the handlers, as in chat.handlers.spec:
		// the service (the brain), the registry, and the sender (the wire).
		friends = {
			listFriends: vi.fn(),
			friendIdsOf: vi.fn(),
			presenceUser: vi.fn(),
		};
		registry = { onChange: vi.fn(), isOnline: vi.fn() };
		dispatcher = { register: vi.fn() };
		sender = { sendToUser: vi.fn(), sendToSocket: vi.fn() };
		handlers = new PresenceHandlers(
			friends as unknown as FriendsService,
			dispatcher as unknown as WsDispatcher,
			registry as unknown as WsRegistry,
			sender as unknown as WsSender,
		);
	});

	it('claims presence.list and listens to the registry', () => {
		handlers.onModuleInit();

		expect(dispatcher.register).toHaveBeenCalledWith(
			'presence.list',
			handlers.list,
		);
		expect(registry.onChange).toHaveBeenCalledTimes(1);
	});

	it('presence.list answers the asking tab with only the online friends', async () => {
		friends.listFriends.mockResolvedValue([
			{ id: ALICE, displayName: 'alice', online: false },
			{ id: DANA, displayName: 'dana', online: true },
		]);
		const client = { data: { userId: CHARLIE } } as unknown as WsSocket;

		await handlers.list(client, {
			type: 'presence.list',
			cid: 'c1',
			payload: {},
		});

		expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
			type: 'presence.state',
			cid: 'c1',
			payload: { users: [{ userId: DANA, displayName: 'dana' }] },
		});
	});

	it('tells each friend when someone comes online', async () => {
		friends.friendIdsOf.mockResolvedValue([CHARLIE, ALICE]);
		friends.presenceUser.mockResolvedValue({
			userId: DANA,
			displayName: 'dana',
		});
		registry.isOnline.mockReturnValue(true);

		await handlers.announce(DANA, true);

		const event = {
			type: 'presence.online',
			payload: { user: { userId: DANA, displayName: 'dana' } },
		};
		expect(sender.sendToUser.mock.calls).toEqual([
			[CHARLIE, event],
			[ALICE, event],
		]);
	});

	it('tells each friend when someone goes offline', async () => {
		friends.friendIdsOf.mockResolvedValue([CHARLIE]);
		registry.isOnline.mockReturnValue(false);

		await handlers.announce(DANA, false);

		expect(sender.sendToUser).toHaveBeenCalledWith(CHARLIE, {
			type: 'presence.offline',
			payload: { userId: DANA },
		});
	});

	it('drops stale news: online, but they already left again', async () => {
		friends.friendIdsOf.mockResolvedValue([CHARLIE]);
		friends.presenceUser.mockResolvedValue({
			userId: DANA,
			displayName: 'dana',
		});
		registry.isOnline.mockReturnValue(false);

		await handlers.announce(DANA, true);

		expect(sender.sendToUser).not.toHaveBeenCalled();
	});

	it('sends nothing for someone with no friends', async () => {
		friends.friendIdsOf.mockResolvedValue([]);

		await handlers.announce(DANA, true);

		expect(sender.sendToUser).not.toHaveBeenCalled();
	});
});
