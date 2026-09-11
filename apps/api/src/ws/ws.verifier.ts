import { Injectable } from '@nestjs/common';

/** The cookie the token arrives in.
 *
 * Duplicated here on purpose and temporarily, will be replaced with import
 * the moment #20 lands.
 */
export const AUTH_COOKIE = 'access_token';

/** Everything the transport needs from the identity slice (turn a token into a user id, or say no).
 *
 * Declared here and not imported from auth, so that the socket layer states what it needs
 * and auth satisfies it. Needed so that I can build and test #21 while #20 is being written.
 */
export abstract class TokenVerifier {
	/** `sub` if the token is valid, otherwise null */
	abstract verify(token: string): string | null;
}

/** Placeholder until #20 auth provides a real one. Refuses everything */
@Injectable()
export class DenyAllVerifier extends TokenVerifier {
	verify(): null {
		return null;
	}
}
