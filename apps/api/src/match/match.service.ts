import { Injectable } from '@nestjs/common';
import { getEngine, outcomeOf, replay } from '@transcendence/shared';
import type { MatchStatePayload } from '@transcendence/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MatchError } from './match.error';

/**
 * The match runtime. The server owns the board; this is where it keeps it.
 *
 * Except it does not keep it. There is no board column and no cache: a Match
 * row plus its Move rows is the whole truth, and every read rebuilds the
 * position by folding the engine's apply() over those rows. That is what makes
 * a rejoin free, and it is why a bug can never leave a stored board and a
 * stored history disagreeing.
 *
 * The user id arrives as a plain argument rather than off a socket, so all of
 * this can be written and tested before the gateway in #21 exists.
 */
@Injectable()
export class MatchService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Everything a client needs to draw a match, whether they have been watching
	 * since the first move or just opened the page.
	 *
	 * `userId` is accepted and deliberately not checked. MatchJoinPayload is
	 * documented as joining "as a player or as a spectator", so there is no seat
	 * gate here; that arrives in step 4, where seatOf() returning null becomes a
	 * match.not_a_player rejection. The parameter stays because the gateway will
	 * pass it and any future visibility rule belongs right here.
	 */
	async join(userId: string, matchId: string): Promise<MatchStatePayload> {
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
					// Load-bearing. Prisma promises no order without it, and
					// replay() throws on an out-of-sequence row rather than
					// sorting, so that a clause forgotten here surfaces as a
					// loud failure instead of a plausible board built from a
					// shuffled history.
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

		// A miss here is a server fault, not a rejection: the game column is an
		// enum this server wrote itself, so an unknown or unimplemented value
		// means a match was created that nothing can run. getEngine throws.
		const engine = getEngine(match.game);
		const position = replay(engine, match.moves);

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

			// serialize, not the raw state. The payload documents this field as
			// what deserialize() accepts. For gomoku the two happen to look
			// alike, which is exactly why skipping it would go unnoticed until
			// an engine whose state is not already JSON.
			state: engine.serialize(position.state),

			// On a finished match the stored winner outranks the board: a
			// resignation ends a game with nobody holding five in a row, so the
			// two legitimately disagree. On an active match nobody has won yet
			// and the replayed position is the only authority.
			//
			// An active match whose replay does show a win is an inconsistency
			// step 4 prevents, by closing the match in the same write that
			// stores the winning move. Report it, never repair it: a read path
			// that writes is a surprise nobody wants to debug.
			outcome:
				match.status === 'finished'
					? outcomeOf(match.winnerId, match)
					: position.outcome,

			moveNumber: position.moveNumber,
		};
	}
}
