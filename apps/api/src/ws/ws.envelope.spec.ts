import { parseEnvelope } from './ws.envelope';

describe('accepts', () => {
	it('a well-formed envelope', () => {
		const event = {
			type: 'chat.send',
			cid: 'c1',
			payload: { conversationId: 'conv-1', body: 'hello' },
		};
		expect(parseEnvelope(event)).toEqual({ ok: true, event });
	});

	it('an envelope with no cid', () => {
		const event = { type: 'match.join', payload: { matchId: 'm1' } };
		expect(parseEnvelope(event)).toEqual({ ok: true, event });
	});

	it('presence.list with an empty payload', () => {
		const event = { type: 'presence.list', payload: {} };
		expect(parseEnvelope(event)).toEqual({ ok: true, event });
	});

	it('match.move with any move value, since the engine parses it', () => {
		const event = {
			type: 'match.move',
			payload: { matchId: 'm1', move: { col: 3 } },
		};
		expect(parseEnvelope(event)).toEqual({ ok: true, event });
	});
});

describe('malformed', () => {
	const malformed = { ok: false, code: 'transport.malformed' };

	it('rejects null', () => {
		expect(parseEnvelope(null)).toEqual(malformed);
	});

	it('rejects a number', () => {
		expect(parseEnvelope(42)).toEqual(malformed);
	});

	it('rejects a string', () => {
		expect(parseEnvelope('hello')).toEqual(malformed);
	});

	it('rejects an array', () => {
		expect(parseEnvelope([1, 2, 3])).toEqual(malformed);
	});

	it('rejects a missing type', () => {
		expect(parseEnvelope({ payload: {} })).toEqual(malformed);
	});

	it('rejects a type that is not a string', () => {
		expect(parseEnvelope({ type: 7, payload: {} })).toEqual(malformed);
	});

	it('rejects a missing payload', () => {
		expect(parseEnvelope({ type: 'presence.list' })).toEqual(malformed);
	});

	it('rejects a payload that is not an object', () => {
		expect(
			parseEnvelope({ type: 'chat.history', payload: 'nope' }),
		).toEqual(malformed);
	});

	it('rejects a cid that is not a string, without echoing it back', () => {
		expect(
			parseEnvelope({ type: 'presence.list', cid: 7, payload: {} }),
		).toEqual(malformed);
	});
});

describe('unknown event', () => {
	it('rejects a type that is not in the protocol', () => {
		expect(parseEnvelope({ type: 'chat.block', payload: {} })).toEqual({
			ok: false,
			code: 'transport.unknown_event',
		});
	});

	it('does not mistake an inherited property for an event', () => {
		expect(parseEnvelope({ type: 'toString', payload: {} })).toEqual({
			ok: false,
			code: 'transport.unknown_event',
		});
	});

	it('echoes the cid so the client can match the rejection', () => {
		expect(
			parseEnvelope({ type: 'chat.block', cid: 'c2', payload: {} }),
		).toEqual({ ok: false, code: 'transport.unknown_event', cid: 'c2' });
	});
});

describe('invalid payload', () => {
	it('rejects chat.send with an empty body', () => {
		expect(
			parseEnvelope({
				type: 'chat.send',
				cid: 'c3',
				payload: { conversationId: 'conv-1', body: '' },
			}),
		).toEqual({ ok: false, code: 'transport.invalid_payload', cid: 'c3' });
	});

	it('rejects chat.send with no conversationId', () => {
		expect(
			parseEnvelope({ type: 'chat.send', payload: { body: 'hello' } }),
		).toEqual({ ok: false, code: 'transport.invalid_payload' });
	});

	it('rejects match.join without a matchId', () => {
		expect(parseEnvelope({ type: 'match.join', payload: {} })).toEqual({
			ok: false,
			code: 'transport.invalid_payload',
		});
	});

	it('rejects match.move with no move key at all', () => {
		expect(
			parseEnvelope({ type: 'match.move', payload: { matchId: 'm1' } }),
		).toEqual({ ok: false, code: 'transport.invalid_payload' });
	});

	it('rejects presence.list carrying anything', () => {
		expect(
			parseEnvelope({ type: 'presence.list', payload: { foo: 1 } }),
		).toEqual({ ok: false, code: 'transport.invalid_payload' });
	});
});
