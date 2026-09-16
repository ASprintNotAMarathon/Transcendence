import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsDispatcher } from '../ws/ws.dispatch';
import type { WsHandler } from '../ws/ws.dispatch';
import { matchRoom } from '../ws/ws.rooms';
import { WsSender } from '../ws/ws.sender';
import type { WsSocket } from '../ws/ws.types';
import { MatchError } from './match.error';
import { MatchService } from './match.service';

/**
 * Where match messages leave the socket layer and reach MatchService.
 *
 * Deliberately thin. Every decision about a match is made in the service;
 * this class only knows who is asking, which room a match lives in, and who
 * should hear the answer.
 *
 * The user id is always `client.data.userId`, set by the handshake. The
 * payload is never read for it, even if a client puts one there.
 */
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

	/**
	 * Subscribe to a match and receive its full snapshot.
	 *
	 * The room is joined before the snapshot is read, never after. The other
	 * way round, a move landing between the read and the join would reach
	 * neither: too late for the snapshot, too early for the room. This order
	 * can at worst deliver a match.moved the snapshot already contains, which
	 * the client drops by its moveNumber.
	 */
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
			// A refused join must not leave the socket in the room, or a
			// mistyped id would keep a subscription to a match nobody sees.
			await client.leave(room);
			this.rejectOrRethrow(client, event.cid, matchId, error);
		}
	};

	/**
	 * Play a move. The sender hears a refusal; the room hears a success.
	 *
	 * The service has already stored the move by the time it returns, so a
	 * broadcast can never announce a move the database does not have.
	 * No cid on the broadcast: it answers nobody in particular, and the sender
	 * recognises its own move by `by` and `moveNumber` like everyone else.
	 */
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

	/** Stop receiving updates. Not a resignation, and nothing to reply. */
	readonly leave: WsHandler<'match.leave'> = async (client, event) => {
		await client.leave(matchRoom(event.payload.matchId));
	};

	/**
	 * A MatchError is the player's doing: tell that one socket and nobody else.
	 * Anything else is a server fault with no protocol code to send, so it is
	 * rethrown for the dispatcher to log.
	 */
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
