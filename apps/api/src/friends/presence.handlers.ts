import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WsDispatcher, type WsHandler } from '../ws/ws.dispatch';
import { WsRegistry } from '../ws/ws.registry';
import { WsSender } from '../ws/ws.sender';
import { FriendsService } from './friends.service';

/**
 * Presence on the socket, for friends only.
 *
 * - presence.list: the asking tab gets presence.state, its online friends.
 * - A user's first socket opens: each friend gets presence.online.
 * - Their last socket closes: each friend gets presence.offline.
 */
@Injectable()
export class PresenceHandlers implements OnModuleInit {
	private readonly logger = new Logger(PresenceHandlers.name);

	constructor(
		private readonly friends: FriendsService,
		private readonly dispatcher: WsDispatcher,
		private readonly registry: WsRegistry,
		private readonly sender: WsSender,
	) {}

	onModuleInit(): void {
		this.dispatcher.register('presence.list', this.list);
		this.registry.onChange((userId, online) => {
			// The registry cannot wait for a database query, so this runs
			// on its own. A failure is logged, never thrown into the gateway.
			this.announce(userId, online).catch((err: unknown) => {
				this.logger.error(`presence for ${userId} failed`, err);
			});
		});
	}

	/** A direct reply to the asking tab, stamped with its cid. */
	readonly list: WsHandler<'presence.list'> = async (client, event) => {
		const friends = await this.friends.listFriends(client.data.userId);
		this.sender.sendToSocket(client, {
			type: 'presence.state',
			cid: event.cid,
			payload: {
				users: friends
					.filter((friend) => friend.online)
					.map((friend) => ({
						userId: friend.id,
						displayName: friend.displayName,
					})),
			},
		});
	};

	/** Tells every friend, on every tab they have open. */
	async announce(userId: string, online: boolean): Promise<void> {
		const friendIds = await this.friends.friendIdsOf(userId);
		if (friendIds.length === 0) {
			return;
		}

		const user = online ? await this.friends.presenceUser(userId) : null;

		// The queries took a moment. If they came back online or left again
		// in between, a newer announcement is on its way: this one is stale.
		if (this.registry.isOnline(userId) !== online) {
			return;
		}

		for (const friendId of friendIds) {
			if (user) {
				this.sender.sendToUser(friendId, {
					type: 'presence.online',
					payload: { user },
				});
			} else if (!online) {
				this.sender.sendToUser(friendId, {
					type: 'presence.offline',
					payload: { userId },
				});
			}
		}
	}
}
