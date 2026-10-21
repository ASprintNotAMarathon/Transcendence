/**
 * Where the browser loads an avatar from. Under /api so the dev proxy already
 * forwards it, and so nginx can later serve the same path straight from disk
 * without the URL, or anything the web app stores, changing.
 */
export const AVATAR_URL_PREFIX = '/api/avatars/';

/**
 * The database keeps the generated file name only. This is the single place
 * that turns it into a URL, so moving the files changes this line and no rows.
 */
export function avatarUrl(avatarPath: string | null): string | null {
	return avatarPath === null ? null : AVATAR_URL_PREFIX + avatarPath;
}
