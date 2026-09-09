import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { EnvConfig } from '../config/env.validation';

/**
 * The single socket entry point. Every real-time message in the app arrives
 * on a connection this class opened.
 *
 * `path` is the Socket.IO endpoint, not a route: it is matched on the raw HTTP
 * server before Nest's router sees the request, so `setGlobalPrefix('api')`
 * does not apply to it. The URL is /ws, not /api/ws. The client must be given
 * the same path — Socket.IO's default is /socket.io and it will not find us
 * otherwise.
 */

// @Something above a class means: hand this class to the function Something
// It's a shorthand for a function call, and the argument is the class sitting underneath it
// @ - a marker, WebSocketGateway - the function, ({ path: '/ws' }) - its argument
// WebSocketGateway is a factory, calling it returns the decorator(the function that receives my class),
// and @ is what applies that to WSGateway
@WebSocketGateway({ path: '/ws' })
export class WsGateway
	implements
		OnGatewayInit<Server>,
		OnGatewayConnection<Socket>,
		OnGatewayDisconnect<Socket>
{
	private readonly logger = new Logger(WsGateway.name);

	constructor(private readonly config: ConfigService<EnvConfig, true>) {}

	/**
	 * Runs once, when Socket.IO is ready but before any client has connected.
	 * Installs the handshake middleware.
	 */
	afterInit(server: Server): void {
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
	 * Who is on the other end of this connection.
	 * 
	 * DEV ONLY. Reads a userId straight off the connection URL and believes it.
	 * There is no verification of any kind - any client can claim to be any user.
	 * This is a stand-in until the auth module exports a verify fucntion, at which
	 * point this reads and verifies the acces_token cookie instead and WS_DEV_AUTH
	 * disappears.
	 * 
	 * Returns null for "refuse this connection", which is also what happens when the flag
	 * is off. There is no real check to fall back on yet, so off means nothing connects.
	 */
	private identify(socket: Socket): string | null {
		if (!this.config.get('WS_DEV_AUTH', { infer: true})) {
			return null;
		}

		const { userId } = socket.handshake.query;
		return typeof userId === 'string' && userId.length > 0 ? userId : null;
	}
	
	handleConnection(client: Socket): void {
		this.logger.log(`connected ${client.id} as ${client.data.userId}`);
	}

	handleDisconnect(client: Socket): void {
		this.logger.log(`disconnected ${client.id} as ${client.data.userId}`);
	}
}
