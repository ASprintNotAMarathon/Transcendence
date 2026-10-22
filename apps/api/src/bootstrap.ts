import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Response } from 'express';
import type { EnvConfig } from './config/env.validation';
import { validationErrorFactory } from './config/validation-error.factory';
import { AVATAR_URL_PREFIX } from './users/avatar';

/**
 * Everything main.ts sets up on the app besides listening. The e2e suites call
 * it too, so they test the application that ships rather than a hand-kept copy
 * of it that drifts the day somebody adds a step here.
 */
export function configureApp(app: NestExpressApplication): void {
	app.setGlobalPrefix('api');
	app.use(cookieParser());
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
			exceptionFactory: validationErrorFactory,
		}),
	);

	// The uploaded avatars, at the URL avatarUrl() builds. Public on purpose:
	// an <img> loads them, and the names are random uuids nobody can guess.
	// nginx will serve this same path from the same folder later, so the
	// URL, and the web app, stay as they are.
	const config = app.get(ConfigService<EnvConfig, true>);
	app.useStaticAssets(config.get('AVATAR_DIR', { infer: true }), {
		prefix: AVATAR_URL_PREFIX,
		// Files only: no folder listing, nothing hidden.
		index: false,
		dotfiles: 'deny',
		// Every upload gets a new name, so a URL's content never changes and
		// the browser may keep it for good. A new avatar is a new URL.
		maxAge: '1y',
		immutable: true,
		setHeaders: (res: Response) => {
			// The type comes from the extension, which came from the real
			// bytes. Stop the browser second-guessing it.
			res.setHeader('X-Content-Type-Options', 'nosniff');
		},
	});
}
