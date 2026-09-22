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

/**
 * Move has exactly one composite unique constraint, on (matchId, moveNumber),
 * so a P2002 from inserting a move can only mean that number was already taken.
 * The code alone is enough; there is no need to read meta.target.
 */
function isMoveNumberTaken(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === 'P2002'
	);
}

/**
 * The match runtime. The server owns the board; this is where it keeps it.
 *
 * Except it does not keep it.
 * There is no board column and no cache: a Match row plus its Move rows is the whole truth,
 * and every read rebuilds the position by folding the engine's apply() over those rows.
 * That is what makes a rejoin free, and it is why a bug
 * can never leave a stored board and a stored history disagreeing.
 *
 * The user id arrives as a plain argument rather than off a socket, so all of
 * this can be written and tested before the gateway in #21 exists.
 */
@Injectable()
export class MatchService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Everything a client needs to draw a match,
	 * whether they have been watching since the first move or just opened the page.
	 *
	 * `userId` is accepted and deliberately not checked.
	 * MatchJoinPayload is documented as joining "as a player or as a spectator", so there is no seat gate here;
	 * that arrives in step 4, where seatOf() returning null becomes a match.not_a_player rejection.
	 * The parameter stays because the gateway will pass it and any future visibility rule belongs right here.
	 */
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

			// serialize, not the raw state.
			// The payload documents this field as what deserialize() accepts.
			// For gomoku the two happen to look alike,
			// which is exactly why skipping it would go unnoticed
			// until an engine whose state is not already JSON.
			state: engine.serialize(position.state),

			// On a finished match the stored winner outranks the board:
			// a resignation ends a game with nobody holding five in a row,
			// so the two legitimately disagree.
			// On an active match nobody has won yet and the replayed position is the only authority.
			//
			// An active match whose replay does show a win is an inconsistency step 4 prevents,
			// by closing the match in the same write that stores the winning move.
			// Report it, never repair it: a read path that writes is a surprise nobody wants to debug.
			outcome:
				match.status === 'finished'
					? outcomeOf(match.winnerId, match)
					: position.outcome,

			moveNumber: position.moveNumber,
		};
	}

	/**
	 * Accept a move, or refuse it and change nothing.
	 *
	 * Every check runs before the first write,
	 * so a refusal costs the sender an error and costs everyone else nothing:
	 * there is no half-applied state to broadcast or roll back.
	 * The checks are ordered so the most specific answer wins,
	 * which is why "the game is over" is reported ahead of "it is not your turn"
	 * even though both are true of a finished match.
	 *
	 * `userId` comes from the caller, never from the payload.
	 * The payload is the client speaking,
	 * and a client that could name its own player id could play as its opponent.
	 */
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

		// Two witnesses, and either one is enough to refuse.
		// The status column is the record; the replayed board is what actually happened.
		// They agree unless a crash landed a winning move without closing the match.
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

		// parseMove only decides whether this is a move at all.
		// It knows nothing about the position,
		// so "shaped like a move" and "playable here" are two separate answers,
		// and the protocol has a separate code for each.
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

				// Same transaction as the move that ended the game,
				// so a finished match can never exist without its result,
				// and a result can never exist without the move that caused it.
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
			// The unique constraint on (matchId, moveNumber) is the concurrency control.
			// Two players submitting at once both pass the checks above against the same position,
			// and the database decides: one insert lands, the other loses.
			// Losing means the position moved on while this request was in flight,
			// which is exactly "not your turn" by the time it mattered.
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

	/**
	 * Load a match and replay it into a position, or throw match.not_found.
	 *
	 * Shared by join and move, so there is one query and one orderBy to get right
	 * instead of two that could drift apart.
	 */
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
					// Load-bearing. Prisma promises no order without it,
					// and replay() throws on an out-of-sequence row rather than sorting,
					// so that a clause forgotten here surfaces as a loud failure
					// instead of a plausible board built from a shuffled history.
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

		// A miss here is a server fault, not a rejection:
		// the game column is an enum this server wrote itself,
		// so an unknown or unimplemented value means a match was created that nothing can run.
		// getEngine throws.
		const engine = getEngine(match.game);

		return { match, engine, position: replay(engine, match.moves) };
	}
}
