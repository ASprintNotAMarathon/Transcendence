import { Logger } from '@nestjs/common';
import {
	OnGatewayConnection,
	OnGatewayDisconnect,
	WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

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
@WebSocketGateway({ path: '/ws' })
export class WsGateway
	implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
	private readonly logger = new Logger(WsGateway.name);

	handleConnection(client: Socket): void {
		this.logger.log(`connected ${client.id}`);
	}

	handleDisconnect(client: Socket): void {
		this.logger.log(`disconnected ${client.id}`);
	}
}
