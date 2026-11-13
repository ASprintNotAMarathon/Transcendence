import { describe, expect, it, vi } from 'vitest';
import { WsLifecycle } from './ws.lifecycle';

describe('WsLifecycle', () => {
	it('tells online listeners who arrived', () => {
		const lifecycle = new WsLifecycle();
		const listener = vi.fn();

		lifecycle.onUserOnline(listener);
		lifecycle.userOnline('u1');

		expect(listener).toHaveBeenCalledWith('u1');
	});

	it('tells offline listeners who left', () => {
		const lifecycle = new WsLifecycle();
		const listener = vi.fn();

		lifecycle.onUserOffline(listener);
		lifecycle.userOffline('u1');

		expect(listener).toHaveBeenCalledWith('u1');
	});

	it('keeps the two kinds apart', () => {
		const lifecycle = new WsLifecycle();
		const online = vi.fn();
		const offline = vi.fn();

		lifecycle.onUserOnline(online);
		lifecycle.onUserOffline(offline);
		lifecycle.userOnline('u1');

		expect(online).toHaveBeenCalledOnce();
		expect(offline).not.toHaveBeenCalled();
	});

	it('stops calling a listener that unsubscribed', () => {
		const lifecycle = new WsLifecycle();
		const listener = vi.fn();

		const unsubscribe = lifecycle.onUserOffline(listener);
		unsubscribe();
		lifecycle.userOffline('u1');

		expect(listener).not.toHaveBeenCalled();
	});

	it('runs the remaining listeners after one throws', () => {
		const lifecycle = new WsLifecycle();
		const second = vi.fn();

		lifecycle.onUserOffline(() => {
			throw new Error('listener is broken');
		});
		lifecycle.onUserOffline(second);

		expect(() => lifecycle.userOffline('u1')).not.toThrow();
		expect(second).toHaveBeenCalledWith('u1');
	});

	it('swallows a rejected async listener', async () => {
		const lifecycle = new WsLifecycle();

		lifecycle.onUserOffline(() => Promise.reject(new Error('db is down')));

		expect(() => lifecycle.userOffline('u1')).not.toThrow();
		// Lets the rejection settle, so an unhandled rejection would surface here.
		await Promise.resolve();
	});
});
