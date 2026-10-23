/**
    Tests ChatService.send() without connecting to a real database.
    Mocks Prisma's database functions and checks that messages are saved correctly
    and invalid requests are rejected.
*/

import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

const USER_0 = { id: 'user-0-uuid', displayName: 'alice' };
const USER_1 = { id: 'user-1-uuid', displayName: 'bob' };
const OUTSIDER_ID = 'outsider-uuid';
const CONVERSATION_ID = 'conversation-uuid';

// Creates a sample conversation
function conversationRow() {
	return {
		id: CONVERSATION_ID,
		user0Id: USER_0.id,
		user1Id: USER_1.id,
	};
}

describe('ChatService.send', () => {
	let service: ChatService;
	let findUnique: ReturnType<typeof vi.fn>;
	let create: ReturnType<typeof vi.fn>;
	let update: ReturnType<typeof vi.fn>;

	// Before each test, create a fresh ChatService with mocked Prisma functions.
	beforeEach(async () => {
		findUnique = vi.fn();
		create = vi.fn();
		update = vi.fn().mockResolvedValue({});

		const moduleRef = await Test.createTestingModule({
			// Replace the real PrismaService with mock database functions.
			providers: [
				ChatService,
				{
					provide: PrismaService,
					useValue: {
						conversation: { findUnique, update },
						message: { create },
					},
				},
			],
		}).compile();

		service = moduleRef.get(ChatService);
	});

	// Valid message: trims whitespace, saves the message and returns its details.
	it('stores the trimmed message and names both members', async () => {
		findUnique.mockResolvedValue(conversationRow());
		create.mockResolvedValue({
			id: 'message-uuid',
			senderId: USER_0.id,
			body: 'hello bob',
			createdAt: new Date('2026-10-16T12:00:00Z'),
			sender: { displayName: USER_0.displayName },
		});

		const sent = await service.send(USER_0.id, {
			conversationId: CONVERSATION_ID,
			body: '  hello bob  ',
		});

		// Check that the database receives the trimmed message.
		expect(create).toHaveBeenCalledWith({
			data: {
				conversationId: CONVERSATION_ID,
				senderId: USER_0.id,
				body: 'hello bob',
			},
			include: { sender: true },
		});
		expect(sent.message).toEqual({
			conversationId: CONVERSATION_ID,
			messageId: 'message-uuid',
			senderId: USER_0.id,
			senderName: 'alice',
			body: 'hello bob',
			createdAt: '2026-10-16T12:00:00.000Z',
		});
		expect(sent.memberIds).toEqual([USER_0.id, USER_1.id]);
		// Check that the conversation timestamp is updated.
		expect(update).toHaveBeenCalledTimes(1);
	});

	// Rejects whitespace-only messages without saving anything.
	it('refuses an empty message without touching the database', async () => {
		await expect(
			service.send(USER_0.id, {
				conversationId: CONVERSATION_ID,
				body: '   ',
			}),
		).rejects.toMatchObject({ code: 'chat.empty_message' });
		expect(create).not.toHaveBeenCalled();
	});
	// Rejects messages longer than the 1000-character limit.
	it('refuses a message over the length limit', async () => {
		await expect(
			service.send(USER_0.id, {
				conversationId: CONVERSATION_ID,
				body: 'x'.repeat(1001),
			}),
		).rejects.toMatchObject({ code: 'chat.message_too_long' });
		expect(create).not.toHaveBeenCalled();
	});
	// Rejects requests for conversations that do not exist.
	it('treats a missing conversation as not found', async () => {
		findUnique.mockResolvedValue(null);
		await expect(
			service.send(USER_0.id, {
				conversationId: CONVERSATION_ID,
				body: 'hello',
			}),
		).rejects.toMatchObject({ code: 'chat.not_found' });
	});

	it('treats a conversation you are not part of like a missing one', async () => {
		findUnique.mockResolvedValue(conversationRow());
		await expect(
			service.send(OUTSIDER_ID, {
				conversationId: CONVERSATION_ID,
				body: 'hello',
			}),
		).rejects.toMatchObject({ code: 'chat.not_found' });
		expect(create).not.toHaveBeenCalled();
	});
});

describe('ChatService.history', () => {
	let service: ChatService;
	let findUnique: ReturnType<typeof vi.fn>;
	let findMany: ReturnType<typeof vi.fn>;

	function messageRow(id: string, body: string, createdAt: string) {
		return {
			id,
			senderId: USER_0.id,
			body,
			createdAt: new Date(createdAt),
			sender: { displayName: USER_0.displayName },
		};
	}

	beforeEach(async () => {
		findUnique = vi.fn();
		findMany = vi.fn();

		const moduleRef = await Test.createTestingModule({
			providers: [
				ChatService,
				{
					provide: PrismaService,
					useValue: {
						conversation: { findUnique },
						message: { findMany },
					},
				},
			],
		}).compile();

		service = moduleRef.get(ChatService);
	});

	it('delivers the page oldest-first', async () => {
		findUnique.mockResolvedValue(conversationRow());
		// the database answers newest-first, the way the service asks for it
		findMany.mockResolvedValue([
			messageRow('message-2', 'second', '2026-10-23T12:01:00Z'),
			messageRow('message-1', 'first', '2026-10-23T12:00:00Z'),
		]);

		const result = await service.history(USER_0.id, {
			conversationId: CONVERSATION_ID,
		});

		expect(result.messages.map((m) => m.messageId)).toEqual([
			'message-1',
			'message-2',
		]);
	});

	it('passes the cursor on when before is given', async () => {
		findUnique.mockResolvedValue(conversationRow());
		findMany.mockResolvedValue([]);

		await service.history(USER_0.id, {
			conversationId: CONVERSATION_ID,
			before: 'message-9',
		});

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({ cursor: { id: 'message-9' }, skip: 1 }),
		);
	});

	it('refuses a conversation you are not part of', async () => {
		findUnique.mockResolvedValue(conversationRow());

		await expect(
			service.history(OUTSIDER_ID, { conversationId: CONVERSATION_ID }),
		).rejects.toMatchObject({ code: 'chat.not_found' });
		expect(findMany).not.toHaveBeenCalled();
	});
});

describe('ChatService.conversations', () => {
	let service: ChatService;
	let findMany: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		findMany = vi.fn();

		const moduleRef = await Test.createTestingModule({
			providers: [
				ChatService,
				{
					provide: PrismaService,
					useValue: { conversation: { findMany } },
				},
			],
		}).compile();

		service = moduleRef.get(ChatService);
	});

	it('describes the other person, whichever seat they hold', async () => {
		findMany.mockResolvedValue([
			{
				id: 'conversation-a',
				user0Id: USER_0.id,
				user1Id: USER_1.id,
				updatedAt: new Date('2026-10-23T12:00:00Z'),
				user0: USER_0,
				user1: USER_1,
			},
			{
				id: 'conversation-b',
				user0Id: USER_1.id,
				user1Id: USER_0.id,
				updatedAt: new Date('2026-10-23T11:00:00Z'),
				user0: USER_1,
				user1: USER_0,
			},
		]);

		const result = await service.conversations(USER_0.id);

		expect(result.conversations).toEqual([
			{
				conversationId: 'conversation-a',
				otherUserId: USER_1.id,
				otherUserName: 'bob',
				lastActivityAt: '2026-10-23T12:00:00.000Z',
			},
			{
				conversationId: 'conversation-b',
				otherUserId: USER_1.id,
				otherUserName: 'bob',
				lastActivityAt: '2026-10-23T11:00:00.000Z',
			},
		]);
	});

	it('asks the database for most recently active first', async () => {
		findMany.mockResolvedValue([]);
		await service.conversations(USER_0.id);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({ orderBy: { updatedAt: 'desc' } }),
		);
	});
});
