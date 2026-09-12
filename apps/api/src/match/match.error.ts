import type { MatchErrorCode } from '@transcendence/shared';

/**
 * A failure the player caused, as opposed to one the server did.
 *
 * That distinction is the whole reason this class exists. A MatchError carries
 * a code from the shared protocol, and the gateway turns it into a
 * `match.rejected` sent to that player alone. Anything else thrown out of
 * MatchService is a server fault: a corrupt history from replay(), a match
 * created for a game with no engine. Those belong in a log and a 500, because
 * there is nothing the client could usefully do with them.
 *
 * Deliberately not a Nest HttpException. This service is reached over a socket,
 * where failures are described by MatchErrorCode rather than status codes, and
 * borrowing HTTP semantics here would only have to be unpicked in the gateway.
 */
export class MatchError extends Error {
	constructor(
		readonly code: MatchErrorCode,
		message?: string,
	) {
		super(message ?? code);
		this.name = 'MatchError';
	}
}
