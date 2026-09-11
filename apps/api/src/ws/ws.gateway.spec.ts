// claude written test for testing the real path refusal included
import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';
import { WsDispatcher } from './ws.dispatch';
import { WsGateway } from './ws.gateway';
import { WsRegistry } from './ws.registry';
import { WsSender } from './ws.sender';
import type { WsServer, WsSocket } from './ws.types';
import { TokenVerifier } from './ws.verifier';

type Middleware = (socket: WsSocket, next: (err?: Error) => void) => void;

/** Accepts one token and nothing else. Stands in for the auth module. */
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
function handshakeOf(devAuth: boolean, verifier: TokenVerifier): Middleware {
	const config = {
		get: () => devAuth,
	} as unknown as ConfigService<EnvConfig, true>;

	const gateway = new WsGateway(
		config,
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

function fakeSocket(options: { cookie?: string; userId?: string }): WsSocket {
	return {
		handshake: {
			headers:
				options.cookie === undefined ? {} : { cookie: options.cookie },
			query:
				options.userId === undefined ? {} : { userId: options.userId },
		},
		data: {},
	} as unknown as WsSocket;
}

describe('handshake', () => {
	const verifier = new StubVerifier('good.jwt', 'u42');

	it('accepts a valid cookie and attaches its user id', () => {
		const socket = fakeSocket({ cookie: 'access_token=good.jwt' });
		const next = jest.fn();

		handshakeOf(false, verifier)(socket, next);

		expect(next).toHaveBeenCalledWith();
		expect(socket.data.userId).toBe('u42');
	});

	it('prefers the cookie over a dev query parameter', () => {
		const socket = fakeSocket({
			cookie: 'access_token=good.jwt',
			userId: 'pretender',
		});
		const next = jest.fn();

		handshakeOf(true, verifier)(socket, next);

		expect(socket.data.userId).toBe('u42');
	});

	it('refuses a cookie the verifier rejects', () => {
		const next = jest.fn();

		handshakeOf(false, verifier)(
			fakeSocket({ cookie: 'access_token=forged.jwt' }),
			next,
		);

		expect(next).toHaveBeenCalledWith(expect.any(Error));
	});

	it('refuses a connection with no cookie and no dev identity', () => {
		const next = jest.fn();

		handshakeOf(false, verifier)(fakeSocket({}), next);

		expect(next).toHaveBeenCalledWith(expect.any(Error));
	});

	it('falls back to the dev identity when the cookie fails and the flag is on', () => {
		const socket = fakeSocket({
			cookie: 'access_token=forged.jwt',
			userId: 'u1',
		});
		const next = jest.fn();

		handshakeOf(true, verifier)(socket, next);

		expect(socket.data.userId).toBe('u1');
	});
});
