import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { basename } from 'node:path';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './../src/app.module';
import type { PublicUser } from './../src/auth';
import { validationErrorFactory } from './../src/config/validation-error.factory';

/** A fresh address per run, as in auth.e2e-spec.ts: the database is live. */
function freshAccount() {
	const id = randomUUID().slice(0, 8);
	return {
		email: `e2e-${id}@example.com`,
		displayName: `e2e-${id}`,
		password: 'correct-horse-battery-staple',
	};
}

/** Carried by hand: supertest will not send a Secure cookie over http. */
function sessionCookie(response: request.Response): string {
	const header = response.headers['set-cookie'] as unknown as string[];
	return header.map((cookie) => cookie.split(';')[0]).join('; ');
}

/** A real 1x1 PNG, the smallest honest upload. */
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64',
);

describe('users (e2e)', () => {
	let app: INestApplication<App>;
	let server: App;
	let cookie: string;
	let me: PublicUser;

	/** A temporary folder per run, set by vitest.config.e2e.mts. */
	const avatarDir = process.env.AVATAR_DIR ?? '';

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		// The same bootstrap main.ts performs.
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

		const registered = await request(server)
			.post('/api/auth/register')
			.send(freshAccount())
			.expect(201);
		cookie = sessionCookie(registered);
		me = registered.body as PublicUser;
	});

	afterAll(async () => {
		await app.close();
	});

	/** Its own account per test, so a change never leaks into another test. */
	async function register(): Promise<{
		cookie: string;
		user: PublicUser;
	}> {
		const response = await request(server)
			.post('/api/auth/register')
			.send(freshAccount())
			.expect(201);
		return {
			cookie: sessionCookie(response),
			user: response.body as PublicUser,
		};
	}

	it('returns a profile with exactly the agreed fields, no email', async () => {
		const response = await request(server)
			.get(`/api/users/${me.id}`)
			.set('Cookie', cookie)
			.expect(200);

		expect(response.body).toEqual({
			id: me.id,
			displayName: me.displayName,
			avatarUrl: null,
			createdAt: me.createdAt,
		});
	});

	it('refuses a visitor who is not logged in', async () => {
		await request(server).get(`/api/users/${me.id}`).expect(401);
	});

	it('answers 400 for an id that is not a uuid', async () => {
		await request(server)
			.get('/api/users/abc')
			.set('Cookie', cookie)
			.expect(400);
	});

	it('answers 404 for a uuid nobody has', async () => {
		await request(server)
			.get(`/api/users/${randomUUID()}`)
			.set('Cookie', cookie)
			.expect(404);
	});

	describe('PATCH /users/me', () => {
		it('renames the caller, and /auth/me sees it at once', async () => {
			const { cookie, user } = await register();
			const newName = `r-${randomUUID().slice(0, 8)}`;

			const renamed = await request(server)
				.patch('/api/users/me')
				.set('Cookie', cookie)
				.send({ displayName: newName })
				.expect(200);

			expect(renamed.body).toEqual({ ...user, displayName: newName });

			const me = await request(server)
				.get('/api/auth/me')
				.set('Cookie', cookie)
				.expect(200);
			expect((me.body as PublicUser).displayName).toBe(newName);
		});

		it('accepts the name the caller already has', async () => {
			const { cookie, user } = await register();

			await request(server)
				.patch('/api/users/me')
				.set('Cookie', cookie)
				.send({ displayName: user.displayName })
				.expect(200);
		});

		it('answers 409 on the displayName field for a taken name', async () => {
			const { cookie } = await register();
			const { user: other } = await register();

			const refused = await request(server)
				.patch('/api/users/me')
				.set('Cookie', cookie)
				.send({ displayName: other.displayName })
				.expect(409);

			expect(refused.body).toEqual({
				statusCode: 409,
				error: 'Conflict',
				errors: { displayName: 'That display name is taken' },
			});
		});

		it('answers 400 for a name register would refuse', async () => {
			const { cookie } = await register();

			const refused = await request(server)
				.patch('/api/users/me')
				.set('Cookie', cookie)
				.send({ displayName: 'a b' })
				.expect(400);

			expect(refused.body).toHaveProperty('errors.displayName');
		});

		it('answers 400 for a field it does not take', async () => {
			const { cookie, user } = await register();

			await request(server)
				.patch('/api/users/me')
				.set('Cookie', cookie)
				.send({ displayName: user.displayName, email: 'x@example.com' })
				.expect(400);
		});

		it('refuses a visitor who is not logged in', async () => {
			await request(server)
				.patch('/api/users/me')
				.send({ displayName: 'nobody' })
				.expect(401);
		});
	});

	describe('POST /users/me/avatar', () => {
		it('stores an image and answers with the new avatarUrl', async () => {
			const { cookie, user } = await register();

			const response = await request(server)
				.post('/api/users/me/avatar')
				.set('Cookie', cookie)
				.attach('avatar', TINY_PNG, 'me.png')
				.expect(200);

			const body = response.body as PublicUser;
			expect(body).toEqual({ ...user, avatarUrl: body.avatarUrl });
			expect(body.avatarUrl).toMatch(
				/^\/api\/avatars\/[0-9a-f-]{36}\.png$/,
			);
			expect(await readdir(avatarDir)).toContain(
				basename(body.avatarUrl ?? ''),
			);
		});

		it('replaces the previous file on a second upload', async () => {
			const { cookie } = await register();
			/** Uploads and returns the stored file name. */
			const upload = async (): Promise<string> => {
				const response = await request(server)
					.post('/api/users/me/avatar')
					.set('Cookie', cookie)
					.attach('avatar', TINY_PNG, 'me.png')
					.expect(200);
				return basename((response.body as PublicUser).avatarUrl ?? '');
			};

			const first = await upload();
			const second = await upload();

			const files = await readdir(avatarDir);
			expect(files).toContain(second);
			expect(files).not.toContain(first);
		});

		it('refuses text that claims to be a PNG', async () => {
			const { cookie } = await register();

			const refused = await request(server)
				.post('/api/users/me/avatar')
				.set('Cookie', cookie)
				.attach('avatar', Buffer.from('not an image'), {
					filename: 'fake.png',
					contentType: 'image/png',
				})
				.expect(400);

			expect(refused.body).toHaveProperty('errors.avatar');
		});

		it('answers 413 for a file over 5 MB', async () => {
			const { cookie } = await register();
			const huge = Buffer.concat([
				TINY_PNG,
				Buffer.alloc(5 * 1024 * 1024),
			]);

			await request(server)
				.post('/api/users/me/avatar')
				.set('Cookie', cookie)
				.attach('avatar', huge, 'huge.png')
				.expect(413);
		});

		it('answers 400 when no file is sent', async () => {
			const { cookie } = await register();

			const refused = await request(server)
				.post('/api/users/me/avatar')
				.set('Cookie', cookie)
				.field('nothing', 'here')
				.expect(400);

			expect(refused.body).toHaveProperty('errors.avatar');
		});

		it('refuses a visitor who is not logged in', async () => {
			await request(server)
				.post('/api/users/me/avatar')
				.attach('avatar', TINY_PNG, 'me.png')
				.expect(401);
		});
	});
});
