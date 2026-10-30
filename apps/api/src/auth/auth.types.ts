import type { Request } from 'express';
import { avatarUrl } from '../users/avatar';

/**
 * Contract decision 03: register, login and /me all return this same object,
 * the User model minus passwordHash. One shape, one serialiser, one place to
 * change when avatars or 2FA arrive.
 */
export type PublicUser = {
	id: string;
	email: string;
	displayName: string;
	avatarUrl: string | null;
	createdAt: Date;
};

/**
 * Passed to every query that returns a user. Selecting the fields keeps
 * passwordHash out of the object entirely, rather than reading the whole row
 * and trusting every future caller to strip it.
 *
 * It reads avatarPath, not avatarUrl: the row holds a file name and
 * toPublicUser turns it into the URL the client gets.
 */
export const PUBLIC_USER_SELECT = {
	id: true,
	email: true,
	displayName: true,
	avatarPath: true,
	createdAt: true,
} as const;

/** What a query with PUBLIC_USER_SELECT hands back. */
export type PublicUserRow = {
	id: string;
	email: string;
	displayName: string;
	avatarPath: string | null;
	createdAt: Date;
};

/**
 * The one serialiser. Every route that returns a user goes through it, so the
 * file-name-to-URL step cannot be forgotten on one of them. Built field by
 * field, so a caller that selected more (login also reads the hash) can pass
 * its row in and nothing extra leaks out.
 */
export function toPublicUser(row: PublicUserRow): PublicUser {
	return {
		id: row.id,
		email: row.email,
		displayName: row.displayName,
		avatarUrl: avatarUrl(row.avatarPath),
		createdAt: row.createdAt,
	};
}

/**
 * What the token carries: the user id, plus the issued-at and expiry the
 * library adds. Typed so signing and verifying cannot drift apart — without it
 * the guard reads a field off an untyped object and a renamed claim breaks
 * silently at runtime.
 */
export type JwtPayload = {
	sub: string;
	iat: number;
	exp: number;
};

/**
 * What the guard puts on the request and @CurrentUser() hands to a controller.
 * Only the id, because only the id is in the token. Anything else would be a
 * snapshot frozen at login, stale the moment the database changes, so a route
 * that needs more looks it up.
 */
export type AuthUser = {
	id: string;
};

/**
 * An Express request once the guard has run. Express has no `user` property of
 * its own, and without this the guard and the decorator would both reach for
 * `any`.
 *
 * Optional on purpose: nothing sets it until a guard runs, so on any unguarded
 * route it genuinely is absent. The decorator carries the check.
 */
export type AuthedRequest = Request & { user?: AuthUser };
