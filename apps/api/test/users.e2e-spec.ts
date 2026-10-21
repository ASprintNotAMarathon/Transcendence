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

describe('users (e2e)', () => {
	let app: INestApplication<App>;
	let server: App;
	let cookie: string;
	let me: PublicUser;

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
		/** Its own account per test, so a rename never changes another test's user. */
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
});
