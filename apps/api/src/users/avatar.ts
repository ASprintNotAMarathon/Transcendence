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

/** The multipart field the file arrives in: `formData.append('avatar', file)`. */
export const AVATAR_FIELD = 'avatar';

/**
 * 5 MB, as agreed with the frontend. Phone photos are often over 2 MB. Multer
 * stops reading at this size, so a huge upload never fills the memory.
 */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export type AvatarType = 'jpg' | 'png' | 'webp';

/**
 * What the file really is, read from its first bytes. The name and the
 * Content-Type the browser sends are text the sender chose, so neither is
 * trusted. Anything else, GIF and SVG included, is null: an SVG is text that
 * can carry a script.
 *
 * The result is also the file's extension, so the name we save it under says
 * what is actually inside.
 */
export function detectImageType(bytes: Buffer): AvatarType | null {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
		return 'jpg';
	}
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return 'png';
	}
	// "RIFF", four bytes of length, then "WEBP".
	if (
		bytes.length >= 12 &&
		bytes.toString('latin1', 0, 4) === 'RIFF' &&
		bytes.toString('latin1', 8, 12) === 'WEBP'
	) {
		return 'webp';
	}
	return null;
}

function startsWith(bytes: Buffer, signature: number[]): boolean {
	return (
		bytes.length >= signature.length &&
		signature.every((byte, i) => bytes[i] === byte)
	);
}
