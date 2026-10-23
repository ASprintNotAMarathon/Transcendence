/**
 * Called by ChatHandlers when a user sends a chat message.
 * Receives the sender's user ID and the message details (conversation ID and text).
 * Checks the message is valid and the user belongs to the conversation.
 * Saves the message in the database and updates the conversation's timestamp.
 * Returns the saved message and both users' IDs so the handler can send it to them.
 */

import { Injectable } from '@nestjs/common';
import type {
	ChatConversationsPayload,
	ChatHistoryPayload,
	ChatHistoryRequestPayload,
	ChatMessagePayload,
	ChatSendPayload,
} from '@transcendence/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ChatError } from './chat.error';

// Maximum number of characters allowed in a message.
const MESSAGE_MAX_LENGTH = 1000;

//How many messages one history request returns
const HISTORY_PAGE_SIZE = 50;

// Describes what ChatService.send() returns:
// the message to deliver and the IDs of both conversation members.
export interface SentMessage {
	readonly message: ChatMessagePayload;
	readonly memberIds: readonly [string, string];
}

// @Injectable() lets NestJS create an instance and provide this object to other classes when asked
@Injectable()
export class ChatService {
	// Constructor: NestJS injects a PrismaService object here so we can access the database.
	// "prisma" is the property name; PrismaService is the class/type.
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Called by ChatHandlers when a user sends a message.
	 * Receives the sender's user ID and the conversation ID and text.
	 * Validates the request, saves the message and updates the conversation timestamp.
	 * Returns the saved message and both members' IDs for WebSocket delivery.
	 */
	async send(userId: string, payload: ChatSendPayload): Promise<SentMessage> {
		// Remove whitespace from the beginning and end of the message.
		const body = payload.body.trim();
		// Reject empty messages, including messages containing only spaces.
		if (body === '') {
			throw new ChatError('chat.empty_message');
		}
		// Reject messages longer than the allowed limit.
		if (body.length > MESSAGE_MAX_LENGTH) {
			throw new ChatError('chat.message_too_long');
		}
		// Find the conversation in the database using its ID.
		// "await" waits for the database query to finish.
		const conversation = await this.memberConversation(
			userId,
			payload.conversationId,
		);
		// Save the message and also fetch the sender's user record.
		// "stored" is the object returned by Prisma after creating the database row.
		const stored = await this.prisma.message.create({
			data: {
				conversationId: conversation.id,
				senderId: userId,
				body,
			},
			include: { sender: true },
		});

		// Update the conversation's timestamp so recently active conversations can appear first.
		await this.prisma.conversation.update({
			where: { id: conversation.id },
			data: { updatedAt: new Date() },
		});
		// Return the data needed by ChatHandlers to notify both conversation members.
		// Convert the database Date object to a string for the message payload.
		return {
			message: {
				conversationId: conversation.id,
				messageId: stored.id,
				senderId: stored.senderId,
				senderName: stored.sender.displayName,
				body: stored.body,
				createdAt: stored.createdAt.toISOString(),
			},
			memberIds: [conversation.user0Id, conversation.user1Id],
		};
	}
	/** One page of messages, delivered oldest-first; `before` pages further back. */
	async history(
		userId: string,
		payload: ChatHistoryRequestPayload,
	): Promise<ChatHistoryPayload> {
		const conversation = await this.memberConversation(
			userId,
			payload.conversationId,
		);

		const rows = await this.prisma.message.findMany({
			where: { conversationId: conversation.id },
			orderBy: { createdAt: 'desc' },
			take: HISTORY_PAGE_SIZE,
			...(payload.before !== undefined
				? { cursor: { id: payload.before }, skip: 1 }
				: {}),
			include: { sender: true },
		});

		// Fetched newest-first so the page is the right one; delivered
		// oldest-first because that is the order a chat screen renders.
		rows.reverse();

		return {
			conversationId: conversation.id,
			messages: rows.map((row) => ({
				conversationId: conversation.id,
				messageId: row.id,
				senderId: row.senderId,
				senderName: row.sender.displayName,
				body: row.body,
				createdAt: row.createdAt.toISOString(),
			})),
		};
	}

	/** Every conversation the user is in, most recently active first. */
	async conversations(userId: string): Promise<ChatConversationsPayload> {
		const rows = await this.prisma.conversation.findMany({
			where: { OR: [{ user0Id: userId }, { user1Id: userId }] },
			orderBy: { updatedAt: 'desc' },
			include: { user0: true, user1: true },
		});

		return {
			conversations: rows.map((row) => {
				// The payload describes the OTHER person, whichever seat they hold.
				const other = row.user0Id === userId ? row.user1 : row.user0;
				return {
					conversationId: row.id,
					otherUserId: other.id,
					otherUserName: other.displayName,
					lastActivityAt: row.updatedAt.toISOString(),
				};
			}),
		};
	}

	/**
	 * The conversation, but only if the asking user is in it. A conversation
	 * you are not part of behaves exactly like one that does not exist,
	 * so conversation ids cannot be probed.
	 */
	private async memberConversation(userId: string, conversationId: string) {
		const conversation = await this.prisma.conversation.findUnique({
			where: { id: conversationId },
		});
		const isMember =
			conversation !== null &&
			(conversation.user0Id === userId ||
				conversation.user1Id === userId);
		if (!isMember) {
			throw new ChatError('chat.not_found');
		}
		return conversation;
	}
}
