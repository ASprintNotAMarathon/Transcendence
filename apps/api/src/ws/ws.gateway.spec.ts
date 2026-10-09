// claude written test for testing the real path refusal included
import 'reflect-metadata';
import { WsDispatcher } from './ws.dispatch';
import { WsGateway } from './ws.gateway';
import { WsRegistry } from './ws.registry';
import { WsSender } from './ws.sender';
import type { WsServer, WsSocket } from './ws.types';
import { TokenVerifier } from './ws.verifier';
import { describe, expect, it, vi } from 'vitest';

type Middleware = (socket: WsSocket, next: (err?: Error) => void) => void;

/**
 * Accepts one token and nothing else. Stands in for the auth module, so a unit
 * test needs no signing secret and no real token to check that the middleware
 * refuses whatever the verifier refuses.
 */
class StubVerifier extends TokenVerifier {
	constructor(
		private readonly accepts: string,
		private readonly userId: string,
	) {
		super();
	}

	verify(token: string): string | null {
		return token === this.accepts ? this.userId : null;
	}
}

/**
 * Builds a gateway and hands back the handshake middleware it installed, so a
 * test can run a connection attempt without a socket server existing.
 */
function handshakeOf(verifier: TokenVerifier): Middleware {
	const gateway = new WsGateway(
		new WsRegistry(),
		new WsDispatcher(),
		new WsSender(),
		verifier,
	);

	let captured: Middleware | undefined;
	const server = {
		use: (fn: Middleware) => {
			captured = fn;
		},
	} as unknown as WsServer;

	gateway.afterInit(server);

	if (captured === undefined) {
		throw new Error('afterInit installed no middleware');
	}
	return captured;
}

/** A connection attempt carrying the given raw Cookie header, or none at all. */
function fakeSocket(cookie?: string): WsSocket {
	return {
		handshake: {
			headers: cookie === undefined ? {} : { cookie },
		},
		data: {},
	} as unknown as WsSocket;
}

describe('handshake', () => {
	const verifier = new StubVerifier('good.jwt', 'u42');

	it('accepts a valid cookie and attaches its user id', () => {
		const socket = fakeSocket('access_token=good.jwt');
		const next = vi.fn();

		handshakeOf(verifier)(socket, next);

		// next() with no argument is how the middleware says yes.
		expect(next).toHaveBeenCalledWith();
		expect(socket.data.userId).toBe('u42');
	});

	it('finds the token among other cookies', () => {
		const socket = fakeSocket('theme=dark; access_token=good.jwt; lang=en');
		const next = vi.fn();

		handshakeOf(verifier)(socket, next);

		expect(socket.data.userId).toBe('u42');
	});

	it('refuses a cookie the verifier rejects', () => {
		const next = vi.fn();

		handshakeOf(verifier)(fakeSocket('access_token=forged.jwt'), next);

		// An argument to next() is how it says no, and no socket is created.
		expect(next).toHaveBeenCalledWith(expect.any(Error));
	});

	it('refuses a connection with no cookie header at all', () => {
		const next = vi.fn();

		handshakeOf(verifier)(fakeSocket(), next);

		expect(next).toHaveBeenCalledWith(expect.any(Error));
	});

	it('refuses a cookie header that carries no token', () => {
		const next = vi.fn();

		handshakeOf(verifier)(fakeSocket('theme=dark; lang=en'), next);

		expect(next).toHaveBeenCalledWith(expect.any(Error));
	});
});
