import type { CookieOptions } from 'express';

export const AUTH_COOKIE = 'access_token';

/**
 * 24 hours, in seconds. Contract decision 05: one token, no revocation.
 * The JWT's expiresIn and the cookie's Max-Age both derive from this.
 */

export const TOKEN_TTL_S = 60 * 60 * 24;

export const TOKEN_COOKIE_OPTIONS: CookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax',
	path: '/',
};
