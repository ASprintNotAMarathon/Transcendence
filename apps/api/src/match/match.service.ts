import { Injectable } from '@nestjs/common';
import {
	getEngine,
	outcomeOf,
	replay,
	seatOf,
	winnerIdOf,
} from '@transcendence/shared';
import type {
	MatchMovePayload,
	MatchMovedPayload,
	MatchStatePayload,
} from '@transcendence/shared';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchError } from './match.error';

function isMoveNumberTaken(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === 'P2002'
	);
}

@Injectable()
export class MatchService {
	constructor(private readonly prisma: PrismaService) {}

	async join(userId: string, matchId: string): Promise<MatchStatePayload> {
		const { match, engine, position } = await this.rebuild(matchId);

		return {
			matchId: match.id,
			game: engine.name,
			players: [
				{
					userId: match.player0.id,
					displayName: match.player0.displayName,
				},
				{
					userId: match.player1.id,
					displayName: match.player1.displayName,
				},
			],
			turn: position.turn,
			state: engine.serialize(position.state),
			outcome:
				match.status === 'finished'
					? outcomeOf(match.winnerId, match)
					: position.outcome,
			moveNumber: position.moveNumber,
		};
	}

	async move(
		userId: string,
		payload: MatchMovePayload,
	): Promise<MatchMovedPayload> {
		const { match, engine, position } = await this.rebuild(payload.matchId);

		const seat = seatOf(userId, match);
		if (seat === null) {
			throw new MatchError(
				'match.not_a_player',
				`user is watching match ${match.id}, not playing in it`,
			);
		}

		if (match.status === 'finished' || position.outcome !== null) {
			throw new MatchError(
				'match.already_over',
				`match ${match.id} has already ended`,
			);
		}

		if (seat !== position.turn) {
			throw new MatchError(
				'match.not_your_turn',
				`seat ${seat} played out of turn, it is player ${position.turn}'s move`,
			);
		}

		let move: unknown;
		try {
			move = engine.parseMove(payload.move);
		} catch (error) {
			throw new MatchError(
				'match.malformed_move',
				(error as Error).message,
			);
		}

		if (!engine.isLegal(position.state, move)) {
			throw new MatchError(
				'match.illegal_move',
				`move is not legal in the current position of match ${match.id}`,
			);
		}

		const moveNumber = position.moveNumber + 1;
		const state = engine.apply(position.state, move);
		const outcome = engine.outcome(state);

		try {
			await this.prisma.$transaction(async (tx) => {
				await tx.move.create({
					data: {
						matchId: match.id,
						moveNumber,
						by: seat,
						payload: move as Prisma.InputJsonValue,
					},
				});

				if (outcome !== null) {
					await tx.match.update({
						where: { id: match.id },
						data: {
							status: 'finished',
							winnerId: winnerIdOf(outcome, match),
						},
					});
				}
			});
		} catch (error) {
			if (isMoveNumberTaken(error)) {
				throw new MatchError(
					'match.not_your_turn',
					`move ${moveNumber} of match ${match.id} was already played`,
				);
			}
			throw error;
		}

		return {
			matchId: match.id,
			moveNumber,
			by: seat,
			move,
			turn: engine.turn(state),
			outcome,
		};
	}

	private async rebuild(matchId: string) {
		const match = await this.prisma.match.findUnique({
			where: { id: matchId },
			select: {
				id: true,
				game: true,
				status: true,
				player0Id: true,
				player1Id: true,
				winnerId: true,
				player0: { select: { id: true, displayName: true } },
				player1: { select: { id: true, displayName: true } },
				moves: {
					orderBy: { moveNumber: 'asc' },
					select: { moveNumber: true, by: true, payload: true },
				},
			},
		});

		if (match === null) {
			throw new MatchError(
				'match.not_found',
				`no match with id ${matchId}`,
			);
		}

		const engine = getEngine(match.game);

		return { match, engine, position: replay(engine, match.moves) };
	}
}
