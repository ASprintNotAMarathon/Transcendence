import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './../src/app.module';
import type { PublicUser } from './../src/auth';
import { validationErrorFactory } from './../src/config/validation-error.factory';

/**
 * These run against a live database, so every run registers an address nobody
 * has used before. A fixed one would pass once and answer 409 ever after.
 */
function freshAccount() {
	const id = randomUUID().slice(0, 8);
	return {
		email: `e2e-${id}@example.com`,
		displayName: `e2e-${id}`,
		password: 'correct-horse-battery-staple',
	};
}

/**
 * supertest's cookie jar will not attach a Secure cookie over plain http:
 * superagent builds its access check with `url.protocol === 'https:'`, which
 * is false here, so `agent()` alone would register successfully and then be
 * anonymous on the next request. Carrying the header explicitly keeps the test
 * about the API rather than about the test client, and leaves the cookie
 * exactly as a browser would receive it.
 */
function sessionCookie(response: request.Response): string {
	const header = response.headers['set-cookie'] as unknown as
		string[] | undefined;

	expect(header, 'expected a Set-Cookie header').toBeDefined();

	return (header ?? []).map((cookie) => cookie.split(';')[0]).join('; ');
}

/** The token on its own, without the cookie name in front of it. */
function tokenFrom(response: request.Response): string {
	const token = sessionCookie(response).split('=')[1] ?? '';

	expect(token.length, 'expected a token in the cookie').toBeGreaterThan(0);

	return token;
}

describe('auth (e2e)', () => {
	let app: INestApplication<App>;
	let server: App;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		// The same bootstrap main.ts performs. Without the pipe and the cookie
		// parser this suite would test a different application than the one
		// that ships.
		app = moduleRef.createNestApplication();
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
		await app.init();
		server = app.getHttpServer();
	});

	afterAll(async () => {
		await app.close();
	});

	it('registers, answers who-am-I, logs out, and then does not', async () => {
		const account = freshAccount();

		const registered = await request(server)
			.post('/api/auth/register')
			.send(account)
			.expect(201);

		expect(registered.body).toMatchObject({
			email: account.email,
			displayName: account.displayName,
		});

		const loggedIn = sessionCookie(registered);

		const me = await request(server)
			.get('/api/auth/me')
			.set('Cookie', loggedIn)
			.expect(200);

		expect((me.body as PublicUser).id).toBe(
			(registered.body as PublicUser).id,
		);

		const loggedOut = await request(server)
			.post('/api/auth/logout')
			.set('Cookie', loggedIn)
			.expect(204);

		// Deliberately the cookie logout handed back, not the one from login.
		// If logout had set a second cookie instead of replacing the first,
		// this request would still be authenticated and the expectation below
		// would fail — which is the whole point of the check.
		await request(server)
			.get('/api/auth/me')
			.set('Cookie', sessionCookie(loggedOut))
			.expect(401);
	});

	it('refuses a request carrying no cookie at all', async () => {
		await request(server).get('/api/auth/me').expect(401);
	});

	it('never puts the token in a response body', async () => {
		const account = freshAccount();

		const registered = await request(server)
			.post('/api/auth/register')
			.send(account)
			.expect(201);

		const loggedIn = await request(server)
			.post('/api/auth/login')
			.send({ email: account.email, password: account.password })
			.expect(200);

		for (const response of [registered, loggedIn]) {
			// The exact token this response issued.
			expect(response.text).not.toContain(tokenFrom(response));

			// And any other JWT: every one begins with the base64 of `{"`,
			// so this catches a token returned under some other name too.
			expect(response.text).not.toContain('eyJ');

			// Nothing beyond the agreed user object, which also rules out the
			// password hash riding along.
			expect(Object.keys(response.body as PublicUser).sort()).toEqual([
				'createdAt',
				'displayName',
				'email',
				'id',
			]);
		}
	});
});
