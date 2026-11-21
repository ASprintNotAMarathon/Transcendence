import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	Res,
	UnauthorizedException,
	UseFilters,
	UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { ExpectedErrorFilter } from '../http/expected-error.filter';
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
	 *
	 * A rejected field (400) or a taken email or name (409) is normal use, so
	 * it answers 200 { ok: false } and the browser logs nothing.
	 */
	@UseFilters(
		new ExpectedErrorFilter(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT),
	)
	@Post('register')
	async register(
		@Body() dto: RegisterDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<PublicUser> {
		const user = await this.auth.register(dto);
		await this.issueCookie(res, user.id);
		return user;
	}

	/**
	 * A login creates nothing, so it answers 200 rather than Nest's default 201.
	 * A wrong email or password (401) or a malformed body (400) is normal use,
	 * so it answers 200 { ok: false } and the browser logs nothing.
	 */
	@UseFilters(
		new ExpectedErrorFilter(
			HttpStatus.BAD_REQUEST,
			HttpStatus.UNAUTHORIZED,
		),
	)
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
	 * The startup check: "is anyone logged in?". Unlike /me it is unguarded and
	 * answers 200 either way, because for a visitor with no cookie "nobody" is
	 * the correct answer, not an error. The browser logs every 4xx in the
	 * console, so the question asked on every page load must not produce one.
	 *
	 * The user is wrapped in an object rather than returned bare: a bare null
	 * goes out as an empty body, which the client cannot parse as JSON.
	 *
	 * It uses the same check as the guard (AuthService.verifySession), so a
	 * bad token is treated the same here: as nobody.
	 *
	 * `expiresIn` is the seconds the session has left. The web app logs
	 * itself out just before then, so after 24h it never sends a request the
	 * guard would answer with a 401.
	 */
	@Get('session')
	async session(
		@Req() req: Request,
	): Promise<{ user: PublicUser; expiresIn: number } | { user: null }> {
		const token = req.cookies?.[AUTH_COOKIE] as string | undefined;
		const session = token ? this.auth.verifySession(token) : null;
		if (session === null) return { user: null };

		try {
			return {
				user: await this.auth.profile(session.userId),
				expiresIn: session.expiresIn,
			};
		} catch (err) {
			// Valid token, deleted user: also nobody.
			if (err instanceof UnauthorizedException) return { user: null };
			throw err;
		}
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
