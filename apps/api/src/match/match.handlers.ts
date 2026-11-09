import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WsDispatcher } from '../ws/ws.dispatch';
import type { WsHandler } from '../ws/ws.dispatch';
import { WsLifecycle } from '../ws/ws.lifecycle';
import { WsRegistry } from '../ws/ws.registry';
import { matchRoom } from '../ws/ws.rooms';
import { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { MatchDisconnects } from './match.disconnects';
import { MatchError } from './match.error';
import { MatchService } from './match.service';

@Injectable()
export class MatchHandlers implements OnModuleInit {
	private readonly logger = new Logger(MatchHandlers.name);

	constructor(
		private readonly service: MatchService,
		private readonly dispatcher: WsDispatcher,
		private readonly sender: WsSender,
		private readonly disconnects: MatchDisconnects,
		private readonly lifecycle: WsLifecycle,
		private readonly registry: WsRegistry,
	) {}

	onModuleInit(): void {
		this.dispatcher.register('match.join', this.join);
		this.dispatcher.register('match.move', this.move);
		this.dispatcher.register('match.resign', this.resign);
		this.dispatcher.register('match.leave', this.leave);
		this.lifecycle.onUserOffline(this.userWentOffline);
		this.lifecycle.onUserOnline(this.userCameOnline);
	}

	readonly join: WsHandler<'match.join'> = async (client, event) => {
		const { matchId } = event.payload;
		const room = matchRoom(matchId);

		await client.join(room);
		try {
			const state = await this.service.join(client.data.userId, matchId);
			this.sender.sendToSocket(client, {
				type: 'match.state',
				cid: event.cid,
				payload: state,
			});
		} catch (error) {
			await client.leave(room);
			this.rejectOrRethrow(client, event.cid, matchId, error);
		}
	};

	readonly move: WsHandler<'match.move'> = async (client, event) => {
		try {
			const moved = await this.service.move(
				client.data.userId,
				event.payload,
			);
			this.sender.broadcast(matchRoom(moved.matchId), {
				type: 'match.moved',
				payload: moved,
			});
		} catch (error) {
			this.rejectOrRethrow(
				client,
				event.cid,
				event.payload.matchId,
				error,
			);
		}
	};

	readonly resign: WsHandler<'match.resign'> = async (client, event) => {
		try {
			const ended = await this.service.resign(
				client.data.userId,
				event.payload.matchId,
			);
			this.sender.broadcast(matchRoom(ended.matchId), {
				type: 'match.ended',
				payload: ended,
			});
		} catch (error) {
			this.rejectOrRethrow(
				client,
				event.cid,
				event.payload.matchId,
				error,
			);
		}
	};

	readonly leave: WsHandler<'match.leave'> = async (client, event) => {
		await client.leave(matchRoom(event.payload.matchId));
	};

	readonly userWentOffline = async (userId: string): Promise<void> => {
		const match = await this.service.current(userId);
		if (match === null || this.registry.isOnline(userId)) {
			return;
		}

		const { matchId } = match;
		const player = match.players[0].userId === userId ? 0 : 1;
		const disconnected = this.disconnects.start(
			userId,
			matchId,
			player,
			() => void this.abandon(userId, matchId),
		);
		this.sender.broadcast(matchRoom(matchId), {
			type: 'match.disconnected',
			payload: disconnected,
		});
	};

	readonly userCameOnline = (userId: string): void => {
		const pending = this.disconnects.cancel(userId);
		if (pending === null) {
			return;
		}

		this.sender.broadcast(matchRoom(pending.matchId), {
			type: 'match.reconnected',
			payload: { matchId: pending.matchId, player: pending.player },
		});
	};

	private async abandon(userId: string, matchId: string): Promise<void> {
		try {
			const ended = await this.service.abandon(userId, matchId);
			if (ended !== null) {
				this.sender.broadcast(matchRoom(ended.matchId), {
					type: 'match.ended',
					payload: ended,
				});
			}
		} catch (error) {
			this.logger.error(
				`could not abandon match ${matchId} for ${userId}`,
				error,
			);
		}
	}

	private rejectOrRethrow(
		client: WsSocket,
		cid: string | undefined,
		matchId: string,
		error: unknown,
	): void {
		if (!(error instanceof MatchError)) {
			throw error;
		}
		this.sender.sendToSocket(client, {
			type: 'match.rejected',
			cid,
			payload: { matchId, code: error.code },
		});
	}
}
