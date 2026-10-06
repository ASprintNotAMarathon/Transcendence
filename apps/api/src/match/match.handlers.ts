import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsDispatcher } from '../ws/ws.dispatch';
import type { WsHandler } from '../ws/ws.dispatch';
import { matchRoom } from '../ws/ws.rooms';
import { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { MatchError } from './match.error';
import { MatchService } from './match.service';

@Injectable()
export class MatchHandlers implements OnModuleInit {
	constructor(
		private readonly service: MatchService,
		private readonly dispatcher: WsDispatcher,
		private readonly sender: WsSender,
	) {}

	onModuleInit(): void {
		this.dispatcher.register('match.join', this.join);
		this.dispatcher.register('match.move', this.move);
		this.dispatcher.register('match.leave', this.leave);
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

	readonly leave: WsHandler<'match.leave'> = async (client, event) => {
		await client.leave(matchRoom(event.payload.matchId));
	};

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
