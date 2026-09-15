import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Res,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AUTH_COOKIE, TOKEN_COOKIE_OPTIONS, TOKEN_TTL_S } from './auth-cookie';
import { AuthService } from './auth.service';
import type { PublicUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly auth: AuthService,
		private readonly jwt: JwtService,
	) {}

	/**
	 * Creating an account also starts the session, so the client does not have
	 * to immediately post the credentials it just sent to a second endpoint.
	 *
	 * The cookie is issued only after the service returns. A duplicate throws
	 * before that line, so a failed registration can never leave a session
	 * behind.
	 */
	@Post('register')
	async register(
		@Body() dto: RegisterDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<PublicUser> {
		const user = await this.auth.register(dto);
		await this.issueCookie(res, user.id);
		return user;
	}

	/** A login creates nothing, so it answers 200 rather than Nest's default 201. */
	@HttpCode(HttpStatus.OK)
	@Post('login')
	async login(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<PublicUser> {
		const user = await this.auth.login(dto);
		await this.issueCookie(res, user.id);
		return user;
	}

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
