import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth';

/** Everything the transport needs from the identity slice (turn a token into a user id, or say no).
 *
 * Declared here and not imported from auth, so that the socket layer states what it needs
 * and auth satisfies it. Needed so that I can build and test #21 while #20 is being written.
 */
export abstract class TokenVerifier {
	/** `sub` if the token is valid, otherwise null */
	abstract verify(token: string): string | null;
}

/**
 * The real verifier. Hands the token to the auth module's verifier. so the signing
 * secret and the verification options live in one place.
 */
@Injectable()
export class JwtTokenVerifier extends TokenVerifier {
	constructor(private readonly auth: AuthService) {
		super();
	}

	verify(token: string): string | null {
		return this.auth.verifyToken(token);
	}
}
