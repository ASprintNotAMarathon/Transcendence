import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	ConnectedSocket,
	MessageBody,
	SubscribeMessage,
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	WebSocketGateway,
} from '@nestjs/websockets';
import type { LifecycleServerEvent } from '@transcendence/shared';
import { parseEnvelope } from './ws.envelope';
import type { EnvConfig } from '../config/env.validation';
import { EVENT } from './ws.types';
import type { WsServer, WsSocket } from './ws.types';
import { WsRegistry } from './ws.registry';
import { userRoom } from './ws.rooms';
import { WsDispatcher } from './ws.dispatch';
import { WsSender } from './ws.sender';
import { readCookie } from './ws.cookie';
import { AUTH_COOKIE, TokenVerifier } from './ws.verifier';

/**
 * The single socket entry point. Every real-time message in the app arrives
 * on a connection this class opened.
 *
 * `path` is the Socket.IO endpoint, not a route: it is matched on the raw HTTP
 * server before Nest's router sees the request, so `setGlobalPrefix('api')`
 * does not apply to it. The URL is /ws, not /api/ws. The client must be given
 * the same path — Socket.IO's default is /socket.io and it will not find us
 * otherwise.
 *
 */
// @Something above a class means: hand this class to the function Something
// It's a shorthand for a function call, and the argument is the class sitting underneath it
// @ - a marker, WebSocketGateway - the function, ({ path: '/ws' }) - its argument
// WebSocketGateway is a factory, calling it returns the decorator(the function that receives my class),
// and @ is what applies that to WSGateway
@WebSocketGateway({ path: '/ws' })
export class WsGateway
	implements
		OnGatewayInit<WsServer>,
		OnGatewayConnection<WsSocket>,
		OnGatewayDisconnect<WsSocket>
{
	private readonly logger = new Logger(WsGateway.name);

	constructor(
		private readonly config: ConfigService<EnvConfig, true>,
		private readonly registry: WsRegistry,
		private readonly dispatcher: WsDispatcher,
		private readonly sender: WsSender,
		private readonly verifier: TokenVerifier,
	) {}

	/**
	 * Runs once, when Socket.IO is ready but before any client has connected.
	 * Installs the handshake middleware.
	 */
	afterInit(server: WsServer): void {
		// The sender cannot reach the server on its own. Only a gateway class can be handed it.
		// Nothing may send before this line has run.
		this.sender.bind(server);

		server.use((socket, next) => {
			const userId = this.identify(socket);
			if (userId === null) {
				next(new Error('unauthorized'));
				return;
			}
			socket.data.userId = userId;
			next();
		});
	}

	/**
	 * Who is on the other end of this connection, or null to refuse it/
	 *
	 * The real check is tried first and is the only one that survives: when #20
	 * lands, fromDevQuery and WS_DEV_AUTH are deleted together and this becomes a
	 * single call to fromCookie
	 */
	private identify(socket: WsSocket): string | null {
		const fromToken = this.fromCookie(socket);
		if (fromToken !== null) {
			return fromToken;
		}

		return this.fromDevQuery(socket);
	}

	/**
	 * The real check, per the auth contract handshake seam.
	 *
	 * Returns null for every token temporarily, because TokenVerifier is still bound
	 * to DenyAllVerifier. Path is real, implementation is missing.
	 */
	private fromCookie(socket: WsSocket): string | null {
		const token = readCookie(socket.handshake.headers.cookie, AUTH_COOKIE);
		if (token === null) {
			return null;
		}

		return this.verifier.verify(token);
	}

	/**
	 * DEV ONLY. Reads userId off the connection URL and believes it.
	 * Will be deleted in the PR that closes #21, together with WS_DEV_AUTH.
	 */
	private fromDevQuery(socket: WsSocket): string | null {
		if (!this.config.get('WS_DEV_AUTH', { infer: true })) {
			return null;
		}

		const { userId } = socket.handshake.query;
		return typeof userId === 'string' && userId.length > 0 ? userId : null;
	}

	/**
	 * Every message from every client arrives here. Validate first; nothing
	 * downstream ever sees an envelope that has not been through parseEnvelope.
	 */
	@SubscribeMessage(EVENT)
	handleMessage(
		@ConnectedSocket() client: WsSocket,
		@MessageBody() raw: unknown,
	): void {
		const result = parseEnvelope(raw);

		if (!result.ok) {
			const error: LifecycleServerEvent = {
				type: 'transport.error',
				cid: result.cid,
				payload: { code: result.code },
			};
			this.sender.sendToSocket(client, error);
			this.logger.log(
				`rejected ${result.code} from ${client.data.userId}`,
			);
			return;
		}

		this.dispatcher.dispatch(client, result.event);
	}

	handleConnection(client: WsSocket): void {
		const { userId } = client.data;
		const cameOnline = this.registry.add(userId, client.id);
		void client.join(userRoom(userId));

		this.logger.log(
			`connected ${client.id} as ${userId}${cameOnline ? ' (now online)' : ''}`,
		);
	}

	handleDisconnect(client: WsSocket): void {
		const { userId } = client.data;
		const wentOffline = this.registry.remove(userId, client.id);

		this.logger.log(
			`disconnected ${client.id} as ${userId}${wentOffline ? ' (now offline)' : ''}`,
		);
	}
}
