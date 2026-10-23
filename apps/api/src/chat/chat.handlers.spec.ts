import type { ChatMessagePayload } from '@transcendence/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsDispatcher } from '../ws/ws.dispatch';
import type { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { ChatError } from './chat.error';
import { ChatHandlers } from './chat.handlers';
import type { ChatService } from './chat.service';

const USER_ID = 'sender-uuid';
const OTHER_ID = 'other-uuid';
const CONVERSATION_ID = 'conversation-uuid';
const CID = 'request-7';

/** What the service returns for an accepted send. The handler only delivers it. */
const message: ChatMessagePayload = {
	conversationId: CONVERSATION_ID,
	messageId: 'message-uuid',
	senderId: USER_ID,
	senderName: 'alice',
	body: 'hello',
	createdAt: '2026-10-23T12:00:00.000Z',
};

describe('ChatHandlers', () => {
	let service: {
		send: ReturnType<typeof vi.fn>;
		history: ReturnType<typeof vi.fn>;
		conversations: ReturnType<typeof vi.fn>;
	};
	let sender: {
		sendToUser: ReturnType<typeof vi.fn>;
		sendToSocket: ReturnType<typeof vi.fn>;
	};
	let client: WsSocket;
	let handlers: ChatHandlers;

	beforeEach(() => {
		// Fakes for everything around the handler: the service (the brain)
		// and the sender (the wire). The handler is tested as pure traffic.
		service = { send: vi.fn(), history: vi.fn(), conversations: vi.fn() };
		sender = { sendToUser: vi.fn(), sendToSocket: vi.fn() };
		client = { data: { userId: USER_ID } } as unknown as WsSocket;

		handlers = new ChatHandlers(
			service as unknown as ChatService,
			{ register: vi.fn() } as unknown as WsDispatcher,
			sender as unknown as WsSender,
		);
	});

	it('claims send, history and conversations, and nothing else', () => {
		const register = vi.fn();
		const withSpy = new ChatHandlers(
			service as unknown as ChatService,
			{ register } as unknown as WsDispatcher,
			sender as unknown as WsSender,
		);

		withSpy.onModuleInit();

		// The dispatcher only lets one owner claim each message type,
		// so this list IS the chat module's surface on the socket.
		expect(register.mock.calls).toEqual([
			['chat.send', withSpy.send],
			['chat.history', withSpy.history],
			['chat.conversations', withSpy.conversations],
		]);
	});

	describe('chat.send', () => {
		it('delivers the stored message to every tab of both members', async () => {
			service.send.mockResolvedValue({
				message,
				memberIds: [USER_ID, OTHER_ID],
			});

			await handlers.send(client, {
				type: 'chat.send',
				payload: { conversationId: CONVERSATION_ID, body: 'hello' },
			});

			// sendToUser = that user's room = all their open tabs.
			// Once per member, sender included — that echo is what
			// renders the message on the sender's own screen.
			expect(sender.sendToUser.mock.calls).toEqual([
				[USER_ID, { type: 'chat.message', payload: message }],
				[OTHER_ID, { type: 'chat.message', payload: message }],
			]);
			// Nothing on the private lane when a send succeeds.
			expect(sender.sendToSocket).not.toHaveBeenCalled();
		});

		it('tells only the sending tab when the service refuses', async () => {
			service.send.mockRejectedValue(new ChatError('chat.empty_message'));

			await handlers.send(client, {
				type: 'chat.send',
				cid: CID,
				payload: { conversationId: CONVERSATION_ID, body: '   ' },
			});

			// The refusal goes to the one connection that asked, cid echoed.
			// Nobody else hears anything.
			expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
				type: 'chat.rejected',
				cid: CID,
				payload: {
					conversationId: CONVERSATION_ID,
					code: 'chat.empty_message',
				},
			});
			expect(sender.sendToUser).not.toHaveBeenCalled();
		});
	});

	describe('chat.history', () => {
		it('answers the asking tab only, cid echoed', async () => {
			const page = {
				conversationId: CONVERSATION_ID,
				messages: [message],
			};
			service.history.mockResolvedValue(page);

			await handlers.history(client, {
				type: 'chat.history',
				cid: CID,
				payload: { conversationId: CONVERSATION_ID },
			});

			// History is an answer to a question, not news for everyone:
			// a direct reply on the asking socket, stamped with its cid.
			expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
				type: 'chat.history_result',
				cid: CID,
				payload: page,
			});
			expect(sender.sendToUser).not.toHaveBeenCalled();
		});
	});

	describe('chat.conversations', () => {
		it('answers with the list of the user on the socket', async () => {
			const list = { conversations: [] };
			service.conversations.mockResolvedValue(list);

			await handlers.conversations(client, {
				type: 'chat.conversations',
				cid: CID,
				payload: {},
			});

			// Identity comes from the authenticated connection, never from
			// the payload — you can only ask for YOUR list.
			expect(service.conversations).toHaveBeenCalledWith(USER_ID);
			expect(sender.sendToSocket).toHaveBeenCalledWith(client, {
				type: 'chat.conversations_result',
				cid: CID,
				payload: list,
			});
		});
	});
});
