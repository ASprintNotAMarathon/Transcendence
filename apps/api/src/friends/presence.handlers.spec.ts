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
		presenceUser: ReturnType<typeof vi.fn>;
		presenceUsers: ReturnType<typeof vi.fn>;
	};
	let registry: {
		onChange: ReturnType<typeof vi.fn>;
		isOnline: ReturnType<typeof vi.fn>;
		onlineUserIds: ReturnType<typeof vi.fn>;
	};
	let dispatcher: { register: ReturnType<typeof vi.fn> };
	let sender: {
		sendToAllExcept: ReturnType<typeof vi.fn>;
		sendToSocket: ReturnType<typeof vi.fn>;
	};
	let handlers: PresenceHandlers;

	beforeEach(() => {
		// Fakes for everything around the handlers, as in chat.handlers.spec:
		// the service (the brain), the registry, and the sender (the wire).
		friends = {
			presenceUser: vi.fn(),
			presenceUsers: vi.fn(),
		};
		registry = {
			onChange: vi.fn(),
			isOnline: vi.fn(),
			onlineUserIds: vi.fn(),
		};
		dispatcher = { register: vi.fn() };
		sender = { sendToAllExcept: vi.fn(), sendToSocket: vi.fn() };
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

	it('presence.list asks for everyone online except the asker', async () => {
		registry.onlineUserIds.mockReturnValue([CHARLIE, DANA, ALICE]);
		friends.presenceUsers.mockResolvedValue([]);
		const client = { data: { userId: CHARLIE } } as unknown as WsSocket;

		await handlers.list(client, {
			type: 'presence.list',
			cid: 'c1',
			payload: {},
		});

		expect(friends.presenceUsers).toHaveBeenCalledWith([DANA, ALICE]);
	});

	it('presence.list answers the asking tab, with its cid', async () => {
		const dana = {
			userId: DANA,
			displayName: 'dana',
			avatarUrl: '/api/avatars/dana.png',
		};
		registry.onlineUserIds.mockReturnValue([CHARLIE, DANA]);
		friends.presenceUsers.mockResolvedValue([dana]);
		const client = { data: { userId: CHARLIE } } as unknown as WsSocket;

		await handlers.list(client, {
			type: 'presence.list',
			cid: 'c1',
			payload: {},
		});

		expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
			type: 'presence.state',
			cid: 'c1',
			payload: { users: [dana] },
		});
	});

	it('tells every other player when someone comes online', async () => {
		const dana = { userId: DANA, displayName: 'dana', avatarUrl: null };
		friends.presenceUser.mockResolvedValue(dana);
		registry.isOnline.mockReturnValue(true);

		await handlers.announce(DANA, true);

		expect(sender.sendToAllExcept).toHaveBeenCalledWith(DANA, {
			type: 'presence.online',
			payload: { user: dana },
		});
	});

	it('tells every other player when someone goes offline', async () => {
		registry.isOnline.mockReturnValue(false);

		await handlers.announce(DANA, false);

		expect(sender.sendToAllExcept).toHaveBeenCalledWith(DANA, {
			type: 'presence.offline',
			payload: { userId: DANA },
		});
	});

	it('drops stale news: online, but they already left again', async () => {
		friends.presenceUser.mockResolvedValue({
			userId: DANA,
			displayName: 'dana',
			avatarUrl: null,
		});
		registry.isOnline.mockReturnValue(false);

		await handlers.announce(DANA, true);

		expect(sender.sendToAllExcept).not.toHaveBeenCalled();
	});

	it('sends nothing for a user who no longer exists', async () => {
		friends.presenceUser.mockResolvedValue(null);
		registry.isOnline.mockReturnValue(true);

		await handlers.announce(DANA, true);

		expect(sender.sendToAllExcept).not.toHaveBeenCalled();
	});
});
