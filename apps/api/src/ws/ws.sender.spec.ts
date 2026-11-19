import type { ServerEvent } from '@transcendence/shared';
import { describe, expect, it, vi } from 'vitest';
import { WsSender } from './ws.sender';
import { EVENT } from './ws.types';
import type { WsServer } from './ws.types';

describe('WsSender.sendToAllExcept', () => {
	it("emits to everyone but the user's own room", () => {
		const emit = vi.fn();
		const except = vi.fn().mockReturnValue({ emit });
		const sender = new WsSender();
		sender.bind({ except } as unknown as WsServer);
		const event: ServerEvent = {
			type: 'presence.offline',
			payload: { userId: 'dana-id' },
		};

		sender.sendToAllExcept('dana-id', event);

		expect(except).toHaveBeenCalledWith('user:dana-id');
		expect(emit).toHaveBeenCalledWith(EVENT, event);
	});
});
