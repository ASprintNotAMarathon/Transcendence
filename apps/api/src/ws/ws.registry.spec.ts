import { describe, expect, it, vi } from 'vitest';
import { WsRegistry } from './ws.registry';

describe('WsRegistry.onChange', () => {
	it('tells listeners on the first socket and the last, never in between', () => {
		const registry = new WsRegistry();
		const listener = vi.fn();
		registry.onChange(listener);

		registry.add('dana', 's1'); // first tab: online
		registry.add('dana', 's2'); // second tab: nothing new
		registry.remove('dana', 's1'); // one tab left: still online
		registry.remove('dana', 's2'); // last tab: offline

		expect(listener.mock.calls).toEqual([
			['dana', true],
			['dana', false],
		]);
	});
});
