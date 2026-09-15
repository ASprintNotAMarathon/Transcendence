import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Res,
	UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AUTH_COOKIE, TOKEN_COOKIE_OPTIONS, TOKEN_TTL_S } from './auth-cookie';
import { AuthService } from './auth.service';
import type { AuthUser, PublicUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
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
	 * Clearing the cookie is the whole of logout: the token itself stays valid
	 * until it expires, so this ends the session in this browser only.
	 *
	 * Deliberately unguarded. The moment clearing matters most is when the
	 * cookie holds a token the server will not accept, and a guard would answer
	 * 401 and leave that cookie in place. Calling it while already anonymous
	 * answers 204 as well.
	 *
	 * The options object is passed whole, never rewritten. A browser matches a
	 * cookie on name, domain and path, so attributes that differ from the ones
	 * used at login do not delete anything — they add a second cookie that
	 * expires at once while the original keeps logging the user in.
	 */
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('logout')
	logout(@Res({ passthrough: true }) res: Response): void {
		res.clearCookie(AUTH_COOKIE, TOKEN_COOKIE_OPTIONS);
	}

	/**
	 * Answers "who is this request from?". A 401 here is a normal answer, not a
	 * failure: for a visitor with no cookie it is the expected one.
	 */
	@UseGuards(JwtAuthGuard)
	@Get('me')
	me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
		return this.auth.profile(user.id);
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
