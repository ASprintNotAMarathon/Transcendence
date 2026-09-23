import {
	Injectable,
	UnauthorizedException,
	type CanActivate,
	type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_COOKIE } from './auth-cookie';
import type { AuthedRequest, JwtPayload } from './auth.types';

/**
 * Turns the cookie into a user id on the request, so nobody else in the
 * codebase ever parses a token.
 *
 * It reads the cookie and only the cookie. Accepting a bearer header as well
 * would reopen the door the design closed, because a header means the frontend
 * has to hold the token somewhere its own JavaScript can reach.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(private readonly jwt: JwtService) {}

	async canActivate(ctx: ExecutionContext): Promise<boolean> {
		const request = ctx.switchToHttp().getRequest<AuthedRequest>();
		const token = request.cookies?.[AUTH_COOKIE] as string | undefined;

		if (!token) {
			throw new UnauthorizedException();
		}

		try {
			// Verifies the signature and the expiry together. Decoding without
			// verifying would happily read an id an attacker chose.
			const payload = await this.jwt.verifyAsync<JwtPayload>(token);
			request.user = { id: payload.sub };
		} catch {
			// Missing, expired, tampered, garbage: one answer. Telling them
			// apart helps somebody probing the API and helps nobody else, and
			// the client does the same thing in every case, which is to log in.
			throw new UnauthorizedException();
		}

		return true;
	}
}
