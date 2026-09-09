import type { ClientEvent, TransportErrorCode } from '@transcendence/shared';

/** Every `type` a client may send, derived from the protocol rather than listed */
type ClientEventType = ClientEvent['type'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

/**
 * One payload check per client event.
 *
 * A record over the union means adding an event to shared/src/ws.ts and
 * forgetting it here is a compile error, rather than a message accepted
 * with an unchecked payload. These are shallow on purpose: enough to reject
 * nonsense, not a schema validator. Anything deeper belongs to whoever handles
 * the event.
 */
const PAYLOAD_CHECKS: Record<
	ClientEventType,
	(payload: Record<string, unknown>) => boolean
> = {
	'match.join': (p) => isNonEmptyString(p.matchId),
	'match.leave': (p) => isNonEmptyString(p.matchId),
	'match.resign': (p) => isNonEmptyString(p.matchId),
	// `move` stays unknown by design, the engine parses it, and a failure
	// there is a match.malformed_move, not a transport errror. Presence is
	// all this layer can check.
	'match.move': (p) => isNonEmptyString(p.matchId) && 'move' in p,
	'chat.send': (p) =>
		isNonEmptyString(p.conversationId) && isNonEmptyString(p.body),
	'chat.history': (p) => isNonEmptyString(p.conversationId),
	'presence.list': (p) => Object.keys(p).length === 0,
};

function isKnownType(type: string): type is ClientEventType {
	return Object.prototype.hasOwnProperty.call(PAYLOAD_CHECKS, type);
}

export type EnvelopeResult =
	| { readonly ok: true; readonly event: ClientEvent }
	| {
			readonly ok: false;
			readonly code: TransportErrorCode;
			readonly cid?: string;
	  };

/**
 * Turn whatever arrived on the wire into either a ClientEvent the rest of the server
 * can trust, or one of the three transport error codes.
 *
 * Pure: no sockets, no logging, no Nest. That is what makes it testable.
 */
export function parseEnvelope(raw: unknown): EnvelopeResult {
	if (!isPlainObject(raw)) {
		return { ok: false, code: 'transport.malformed' };
	}

	// read cid first, so even a rejection can be correlated to the request
	const { type, cid, payload } = raw;
	if (cid !== undefined && typeof cid !== 'string') {
		return { ok: false, code: 'transport.malformed' };
	}

	if (typeof type !== 'string' || !isPlainObject(payload)) {
		return { ok: false, code: 'transport.malformed', cid };
	}

	if (!isKnownType(type)) {
		return { ok: false, code: 'transport.unknown_event', cid };
	}

	if (!PAYLOAD_CHECKS[type](payload)) {
		return { ok: false, code: 'transport.invalid_payload', cid };
	}

	// the only assertion in the file. the checks have established this, but
	// TypeScript cannot follow that chain on it's own
	return { ok: true, event: raw as unknown as ClientEvent };
}
