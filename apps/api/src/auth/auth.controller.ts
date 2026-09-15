import { Controller } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AUTH_COOKIE, TOKEN_COOKIE_OPTIONS, TOKEN_TTL_S } from './auth-cookie';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly auth: AuthService,
		private readonly jwt: JwtService,
	) {}

	/**
	 * Signs the token and sets the cookie. Register and login both start a
	 * session, so they share this rather than repeating it: two copies drift,
	 * and a cookie whose attributes differ between the two paths produces a
	 * bug that only shows up on one of them.
	 *
	 * The payload carries the user id and nothing else. Anything else in there
	 * is a snapshot frozen at login, stale the moment the database changes.
	 *
	 * No expiry is passed: the auth module set it when it registered the JWT
	 * module, so every token signed anywhere gets the same lifetime.
	 */
	private async issueCookie(res: Response, userId: string): Promise<void> {
		const token = await this.jwt.signAsync({ sub: userId });

		// The JWT library counts seconds, Express counts milliseconds. One
		// constant, converted at the single place Express reads it.
		res.cookie(AUTH_COOKIE, token, {
			...TOKEN_COOKIE_OPTIONS,
			maxAge: TOKEN_TTL_S * 1000,
		});
	}
}
