import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { MatchMovedPayload } from '@transcendence/shared';
import { WsDispatcher } from '../ws/ws.dispatch';
import type { WsHandler } from '../ws/ws.dispatch';
import { lobbyRoom } from '../ws/ws.rooms';
import { WsSender } from '../ws/ws.sender';
import { MatchService } from './match.service';

@Injectable()
export class MatchLobby implements OnModuleInit {
	private readonly logger = new Logger(MatchLobby.name);

	constructor(
		private readonly service: MatchService,
		private readonly dispatcher: WsDispatcher,
		private readonly sender: WsSender,
	) {}

	onModuleInit(): void {
		this.dispatcher.register('lobby.join', this.join);
		this.dispatcher.register('lobby.leave', this.leave);
	}

	readonly join: WsHandler<'lobby.join'> = async (client, event) => {
		await client.join(lobbyRoom());
		this.sender.sendToSocket(client, {
			type: 'lobby.joined',
			cid: event.cid,
			payload: {},
		});
	};

	readonly leave: WsHandler<'lobby.leave'> = async (client) => {
		await client.leave(lobbyRoom());
	};

	async started(matchId: string): Promise<void> {
		try {
			const match = await this.service.liveMatch(matchId);
			if (match !== null) {
				this.sender.broadcast(lobbyRoom(), {
					type: 'lobby.started',
					payload: match,
				});
			}
		} catch (error) {
			this.logger.error(`could not announce match ${matchId}`, error);
		}
	}

	moved({ matchId, moveNumber, turn, outcome }: MatchMovedPayload): void {
		if (outcome !== null) {
			this.ended(matchId);
			return;
		}
		this.sender.broadcast(lobbyRoom(), {
			type: 'lobby.moved',
			payload: { matchId, moveNumber, turn },
		});
	}

	ended(matchId: string): void {
		this.sender.broadcast(lobbyRoom(), {
			type: 'lobby.ended',
			payload: { matchId },
		});
	}
}
