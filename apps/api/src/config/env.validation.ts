/**
 * Validates process.env at boot, so a missing or malformed variable
 * stops the app immediately with a clear message instead of failing
 * later on the one route that needed it.
 *
 * Passed to ConfigModule.forRoot({ validate }) in app.module.ts.
 */

import { isAbsolute, join, resolve } from 'node:path';

export interface EnvConfig {
	API_PORT: number;
	DATABASE_URL: string;
	JWT_SECRET: string;
	/** Absolute by the time anything reads it. */
	AVATAR_DIR: string;
}

/**
 * The repo root, four levels above this file from both apps/api/src/config
 * (dev) and apps/api/dist/config (built), the same reasoning as ROOT_ENV in
 * app.module.ts.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * Uploaded avatars. Outside Docker this lands in the repo, where .gitignore
 * keeps it out of commits. A relative AVATAR_DIR is read from the repo root
 * too, so it means the same folder wherever the API was started from.
 */
const DEFAULT_AVATAR_DIR = 'uploads/avatars';

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

/** 32 bytes of entropy, the hex form of `openssl rand -hex 32` being 64 chars. */
const JWT_SECRET_MIN_LENGTH = 32;

/** Prefix of the placeholder in .env.example, long enough to pass the length check. */
const PLACEHOLDER_PREFIX = 'changeme';

export function validateEnv(config: Record<string, unknown>): EnvConfig {
	const missing = REQUIRED.filter((key) => !config[key]);
	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variable(s): ${missing.join(', ')}.\n` +
				'The repo has a single env file at its root: copy .env.example to .env and fill in the values.',
		);
	}

	const port = config.API_PORT === undefined ? 3000 : Number(config.API_PORT);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(
			`API_PORT must be an integer between 1 and 65535, got "${String(config.API_PORT)}"`,
		);
	}

	// The value is never echoed back: this message ends up in logs and CI output.
	const jwtSecret = String(config.JWT_SECRET);
	if (jwtSecret.startsWith(PLACEHOLDER_PREFIX)) {
		throw new Error(
			'JWT_SECRET is still the placeholder from .env.example. ' +
				'Generate a real one with: openssl rand -hex 32',
		);
	}
	if (jwtSecret.length < JWT_SECRET_MIN_LENGTH) {
		throw new Error(
			`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters, got ${jwtSecret.length}. ` +
				'Generate one with: openssl rand -hex 32',
		);
	}

	const avatarDir =
		typeof config.AVATAR_DIR === 'string' && config.AVATAR_DIR !== ''
			? config.AVATAR_DIR
			: DEFAULT_AVATAR_DIR;

	return {
		API_PORT: port,
		DATABASE_URL: String(config.DATABASE_URL),
		JWT_SECRET: jwtSecret,
		AVATAR_DIR: isAbsolute(avatarDir)
			? avatarDir
			: resolve(REPO_ROOT, avatarDir),
	};
}
