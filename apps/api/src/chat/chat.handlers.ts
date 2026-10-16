import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsDispatcher } from '../ws/ws.dispatch';
import type { WsHandler } from '../ws/ws.dispatch';
import { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { ChatError } from './chat.error';
import { ChatService } from './chat.service';

/**
Called by WsDispatcher when a browser sends a 'chat.send' event.
Passes the sender's user ID and message payload to ChatService
Sends the saved message to every open tab of both conversation members.
If sending fails, sends a 'chat.rejected' event for known chat errors.
Does not return a value; communicates with browsers through WebSocket events.
*/

@Injectable()
export class ChatHandlers implements OnModuleInit {
	// NestJS injects these existing objects so this class can use their functionality:
	// ChatService handles message validation and database storage.
	// WsDispatcher routes incoming WebSocket events to the correct handler.
	// WsSender delivers outgoing events to connected sockets.
	constructor(
		private readonly service: ChatService,
		private readonly dispatcher: WsDispatcher,
		private readonly sender: WsSender,
	) {}
	// NestJS calls onModuleInit() once when the backend starts (e.g. npm run start:dev).
	// Register ChatHandlers.send() with the existing WsDispatcher,
	// so WsDispatcher can call ChatHandlers.send() when a browser sends a 'chat.send' event.
	onModuleInit(): void {
		this.dispatcher.register('chat.send', this.send);
	}
	// Handles incoming 'chat.send' events from a browser.
	// WsHandler<'chat.send'> defines the expected event and handler types.
	readonly send: WsHandler<'chat.send'> = async (client, event) => {
		try {
			// Call ChatService.send() to validate and save the message.
			// Pass the sender's user ID (client.data.userId) and the message payload (event.payload).
			const sent = await this.service.send(
				client.data.userId,
				event.payload,
			);
			// Every open tab of both people, the sender's own tabs included:
			// the sender's screen renders from this echo, exactly like the mock.
			for (const memberId of sent.memberIds) {
				// Send the saved message to every connected tab of both conversation members.
				// This also sends it back to the sender, so their own screen shows the message.
				this.sender.sendToUser(memberId, {
					type: 'chat.message',
					payload: sent.message,
				});
			}
		} catch (error) {
			this.rejectOrRethrow(
				client,
				event.cid,
				event.payload.conversationId,
				error,
			);
		}
	};
	// Sends a rejection to the requesting socket for known chat errors.
	// Other errors are thrown again so they aren't silently hidden.
	private rejectOrRethrow(
		client: WsSocket,
		cid: string | undefined,
		conversationId: string,
		error: unknown,
	): void {
		if (!(error instanceof ChatError)) {
			throw error;
		}
		this.sender.sendToSocket(client, {
			type: 'chat.rejected',
			cid,
			payload: { conversationId, code: error.code },
		});
	}
}
