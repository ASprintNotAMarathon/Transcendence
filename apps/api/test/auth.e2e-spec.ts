import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './../src/app.module';
import type { JwtPayload, PublicUser } from './../src/auth';
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

/**
 * Everything after the value, minus the two attributes that are meant to
 * differ between setting a cookie and clearing one. What is left is the set a
 * browser matches on, so login and logout must agree on it exactly.
 */
function cookieAttributes(response: request.Response): string[] {
	const header = response.headers['set-cookie'] as unknown as string[];

	return (header[0] ?? '')
		.split(';')
		.slice(1)
		.map((part) => part.trim())
		.filter((part) => !/^(expires|max-age)=/i.test(part))
		.sort();
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

	it('refuses a token that has been edited', async () => {
		const account = freshAccount();

		const registered = await request(server)
			.post('/api/auth/register')
			.send(account)
			.expect(201);

		const token = tokenFrom(registered);

		// The untouched token works, so a 401 below is about the editing and
		// not about something else being wrong.
		await request(server)
			.get('/api/auth/me')
			.set('Cookie', `access_token=${token}`)
			.expect(200);

		const [header, payload, signature] = token.split('.');
		const claims = JSON.parse(
			Buffer.from(payload, 'base64url').toString('utf8'),
		) as JwtPayload;

		expect(claims.sub).toBe((registered.body as PublicUser).id);

		// Somebody else's id, with the original signature left in place. This
		// is the attack the signature exists to stop: the payload is readable
		// by anyone, so the only thing preventing an edit is that the
		// signature no longer matches what it covers.
		claims.sub = '00000000-0000-4000-8000-000000000000';
		const forged = [
			header,
			Buffer.from(JSON.stringify(claims)).toString('base64url'),
			signature,
		].join('.');

		expect(forged).not.toBe(token);

		// A signature altered by a single character.
		const corrupted = [
			header,
			payload,
			signature.slice(0, -1) + (signature.endsWith('a') ? 'b' : 'a'),
		].join('.');

		for (const bad of [forged, corrupted, 'not-a-token-at-all']) {
			const refused = await request(server)
				.get('/api/auth/me')
				.set('Cookie', `access_token=${bad}`)
				.expect(401);

			// One answer for every kind of bad token, so nothing tells an
			// attacker which part they got wrong.
			expect(refused.body).toEqual({
				statusCode: 401,
				message: 'Unauthorized',
			});
		}
	});

	it('clears the cookie with the attributes it was set with', async () => {
		const account = freshAccount();

		const registered = await request(server)
			.post('/api/auth/register')
			.send(account)
			.expect(201);

		const loggedOut = await request(server)
			.post('/api/auth/logout')
			.set('Cookie', sessionCookie(registered))
			.expect(204);

		// Named explicitly, so dropping one is caught even if both responses
		// drop it together.
		expect(cookieAttributes(loggedOut)).toEqual([
			'HttpOnly',
			'Path=/',
			'SameSite=Lax',
			'Secure',
		]);

		// And compared, so adding one to a single side is caught too. A Domain
		// on the login cookie and not this one makes them different cookies to
		// a browser, and logout silently stops working.
		expect(cookieAttributes(loggedOut)).toEqual(
			cookieAttributes(registered),
		);

		const raw = (loggedOut.headers['set-cookie'] as unknown as string[])[0];

		// Emptied, and expired in the past. These two are supposed to differ.
		expect(raw.startsWith('access_token=;')).toBe(true);
		expect(raw).toContain('Expires=Thu, 01 Jan 1970');
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
