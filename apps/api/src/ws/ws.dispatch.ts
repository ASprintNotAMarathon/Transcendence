import { Injectable, Logger } from '@nestjs/common';
import type { ClientEvent } from '@transcendence/shared';
import type { WsSocket } from './ws.types';

type ClientEventType = ClientEvent['type'];

/**
 * What a slice provides in order to own one kind of message.
 *
 * Extract picks the single member of the ClientEvent union whose type matches,
 * so a handler registered for 'match.move' is handed exactly a match.move
 * envelope and not the whole union to sort through.
 */
export type WsHandler<T extends ClientEventType> = (
	client: WsSocket,
	event: Extract<ClientEvent, { type: T }>,
) => void | Promise<void>;

/**
 * Routes a validated envelope to whoever owns that message.
 *
 * The transport knows nothing about what a match or a conversation is.
 * It knows only that somebody claimed a message type and how to reach them,
 * which is what keeps game and chat logic out of this slice.
 */
@Injectable()
export class WsDispatcher {
	private readonly logger = new Logger(WsDispatcher.name);

	private readonly handlers = new Map<
		ClientEventType,
		WsHandler<ClientEventType>
	>();

	register<T extends ClientEventType>(type: T, handler: WsHandler<T>): void {
		if (this.handlers.has(type)) {
			throw new Error(`Two handlers registered for ${type}`);
		}

		// register is the only way in, and its signature keeps the key and the
		// handler's event type in step. dispatch only ever looks up by
		// event.type and passes that same event.
		this.handlers.set(
			type,
			handler as unknown as WsHandler<ClientEventType>,
		);
	}

	dispatch(client: WsSocket, event: ClientEvent): void {
		const handler = this.handlers.get(event.type);

		if (handler === undefined) {
			this.logger.warn(`no handler for ${event.type}, dropped`);
			return;
		}

		Promise.resolve(handler(client, event)).catch((err: unknown) => {
			this.logger.error(`${event.type} handler threw`, err);
		});
	}
}
