/**
 * Contract decision 03: register, login and /me all return this same object,
 * the User model minus passwordHash. One shape, one serialiser, one place to
 * change when avatars or 2FA arrive.
 */
export type PublicUser = {
	id: string;
	email: string;
	displayName: string;
	createdAt: Date;
};

/**
 * Passed to every query that returns a user. Selecting the fields keeps
 * passwordHash out of the object entirely, rather than reading the whole row
 * and trusting every future caller to strip it.
 */
export const PUBLIC_USER_SELECT = {
	id: true,
	email: true,
	displayName: true,
	createdAt: true,
} as const;
