import { avatarUrl } from './avatar';

/**
 * What anyone sees of another user. PublicUser minus the email: that one is
 * for logging in, and only its owner gets it back, from /auth/me.
 */
export type PublicProfile = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
	createdAt: Date;
};

/**
 * Email is never selected, rather than read and then deleted, so no future
 * caller can forget to strip it.
 */
export const PUBLIC_PROFILE_SELECT = {
	id: true,
	displayName: true,
	avatarPath: true,
	createdAt: true,
} as const;

/** What a query with PUBLIC_PROFILE_SELECT hands back. */
export type PublicProfileRow = {
	id: string;
	displayName: string;
	avatarPath: string | null;
	createdAt: Date;
};

/** The file name becomes a URL here, the same step toPublicUser does. */
export function toPublicProfile(row: PublicProfileRow): PublicProfile {
	return {
		id: row.id,
		displayName: row.displayName,
		avatarUrl: avatarUrl(row.avatarPath),
		createdAt: row.createdAt,
	};
}
