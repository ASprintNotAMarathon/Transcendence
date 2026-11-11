import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { implementedGames } from '@transcendence/shared';
import type {
	GameName,
	QueueErrorCode,
	ServerEvent,
} from '@transcendence/shared';
import { WsDispatcher } from '../ws/ws.dispatch';
import type { WsHandler } from '../ws/ws.dispatch';
import { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { MatchQueue } from './match.queue';
import { MatchService } from './match.service';

@Injectable()
export class MatchQueueHandlers implements OnModuleInit {
	private readonly logger = new Logger(MatchQueueHandlers.name);
	private readonly watched = new WeakSet<WsSocket>();

	constructor(
		private readonly service: MatchService,
		private readonly queue: MatchQueue,
		private readonly dispatcher: WsDispatcher,
		private readonly sender: WsSender,
	) {}

	onModuleInit(): void {
		this.dispatcher.register('queue.join', this.join);
		this.dispatcher.register('queue.leave', this.leave);
	}

	readonly join: WsHandler<'queue.join'> = async (client, event) => {
		const { userId } = client.data;
		const { game } = event.payload;

		if (!implementedGames.includes(game)) {
			this.reject(client, event.cid, 'queue.unknown_game');
			return;
		}
		if (!this.queue.claim(userId)) {
			this.reject(client, event.cid, 'queue.already_queued');
			return;
		}

		try {
			if ((await this.service.current(userId)) !== null) {
				this.reject(client, event.cid, 'queue.in_match');
				return;
			}
			if (client.disconnected) {
				return;
			}

			const opponent = this.queue.takeFor(game);
			if (opponent === null) {
				this.wait(client, game);
				return;
			}
			await this.pair(game, opponent.userId, userId);
		} catch (error) {
			this.logger.error(`queue.join failed for user ${userId}`, error);
			this.reject(client, event.cid, 'queue.failed');
		} finally {
			this.queue.release(userId);
		}
	};

	readonly leave: WsHandler<'queue.leave'> = (client) => {
		this.queue.leave(client.data.userId);
	};

	private wait(client: WsSocket, game: GameName): void {
		this.queue.wait({
			userId: client.data.userId,
			game,
			socketId: client.id,
		});
		if (this.watched.has(client)) {
			return;
		}
		this.watched.add(client);
		client.once('disconnect', () => this.queue.leaveSocket(client.id));
	}

	private async pair(
		game: GameName,
		waiterId: string,
		joinerId: string,
	): Promise<void> {
		try {
			const matchId = await this.service.create(game, waiterId, joinerId);
			this.tellBoth(waiterId, joinerId, {
				type: 'queue.matched',
				payload: { matchId },
			});
		} catch (error) {
			this.logger.error(
				`could not create a ${game} match for ${waiterId} and ${joinerId}`,
				error,
			);
			this.tellBoth(waiterId, joinerId, {
				type: 'queue.rejected',
				payload: { code: 'queue.failed' },
			});
		} finally {
			this.queue.release(waiterId);
		}
	}

	private tellBoth(first: string, second: string, event: ServerEvent): void {
		this.sender.sendToUser(first, event);
		this.sender.sendToUser(second, event);
	}

	private reject(
		client: WsSocket,
		cid: string | undefined,
		code: QueueErrorCode,
	): void {
		this.sender.sendToSocket(client, {
			type: 'queue.rejected',
			cid,
			payload: { code },
		});
	}
}
