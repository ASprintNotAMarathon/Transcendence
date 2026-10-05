import {
	Injectable,
	UnauthorizedException,
	type CanActivate,
	type ExecutionContext,
} from '@nestjs/common';
import { AUTH_COOKIE } from './auth-cookie';
import { AuthService } from './auth.service';
import type { AuthedRequest } from './auth.types';

/**
 * Turns the cookie into a user id on the request, so nobody else in the
 * codebase ever parses a token.
 *
 * It reads the cookie and only the cookie. Accepting a bearer header as well
 * would reopen the door the design closed, because a header means the frontend
 * has to hold the token somewhere its own JavaScript can reach.
 *
 * The check itself lives in AuthService.verifyToken, which the socket
 * handshake calls too. This class owns only the HTTP half: where the token
 * comes from, and what refusing looks like over HTTP.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(private readonly auth: AuthService) {}

	canActivate(ctx: ExecutionContext): boolean {
		const request = ctx.switchToHttp().getRequest<AuthedRequest>();
		const token = request.cookies?.[AUTH_COOKIE] as string | undefined;
		const userId = token ? this.auth.verifyToken(token) : null;

		// Missing, expired, tampered, garbage: one answer. Telling them apart
		// helps somebody probing the API and helps nobody else, and the client
		// does the same thing in every case, which is to log in.
		if (userId === null) {
			throw new UnauthorizedException();
		}

		request.user = { id: userId };
		return true;
	}
}
