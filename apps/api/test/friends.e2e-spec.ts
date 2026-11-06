import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';
import type { PublicUser } from './../src/auth';

/** A fresh account per call: the database is live and shared. */
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

type Player = { cookie: string; user: PublicUser };
type RequestRow = { id: string; user: { id: string } };

describe('friends (e2e)', () => {
	let app: NestExpressApplication;
	let server: App;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();
		app = moduleRef.createNestApplication<NestExpressApplication>();
		configureApp(app);
		await app.init();
		server = app.getHttpServer();
	});

	afterAll(async () => {
		await app.close();
	});

	async function register(): Promise<Player> {
		const response = await request(server)
			.post('/api/auth/register')
			.send(freshAccount())
			.expect(201);
		return {
			cookie: sessionCookie(response),
			user: response.body as PublicUser,
		};
	}

	function send(from: Player, to: Player) {
		return request(server)
			.post('/api/friends/requests')
			.set('Cookie', from.cookie)
			.send({ userId: to.user.id });
	}

	async function requestsOf(player: Player) {
		const response = await request(server)
			.get('/api/friends/requests')
			.set('Cookie', player.cookie)
			.expect(200);
		return response.body as {
			incoming: RequestRow[];
			outgoing: RequestRow[];
		};
	}

	async function friendIdsOf(player: Player): Promise<string[]> {
		const response = await request(server)
			.get('/api/friends')
			.set('Cookie', player.cookie)
			.expect(200);
		return (response.body as { id: string }[]).map((f) => f.id);
	}

	it('send, see it on both sides, accept, then both are friends', async () => {
		const a = await register();
		const b = await register();

		const sent = await send(a, b).expect(201);
		expect(sent.body).toEqual({ friendship: 'requested' });

		expect((await requestsOf(a)).outgoing[0]?.user.id).toBe(b.user.id);
		const incoming = (await requestsOf(b)).incoming;
		expect(incoming[0]?.user.id).toBe(a.user.id);

		await request(server)
			.post(`/api/friends/requests/${incoming[0]?.id}/accept`)
			.set('Cookie', b.cookie)
			.expect(204);

		expect(await friendIdsOf(a)).toEqual([b.user.id]);
		expect(await friendIdsOf(b)).toEqual([a.user.id]);
		expect(await requestsOf(a)).toEqual({ incoming: [], outgoing: [] });
	});

	it('a friend in the list has no email', async () => {
		const a = await register();
		const b = await register();
		await send(a, b).expect(201);
		await send(b, a).expect(201);

		const response = await request(server)
			.get('/api/friends')
			.set('Cookie', a.cookie)
			.expect(200);
		expect(response.body).toEqual([
			{
				id: b.user.id,
				displayName: b.user.displayName,
				avatarUrl: null,
				createdAt: b.user.createdAt,
			},
		]);
	});

	it('sending one back accepts theirs', async () => {
		const a = await register();
		const b = await register();
		await send(a, b).expect(201);

		const back = await send(b, a).expect(201);

		expect(back.body).toEqual({ friendship: 'friends' });
		expect(await friendIdsOf(a)).toEqual([b.user.id]);
	});

	it('decline removes the request for both', async () => {
		const a = await register();
		const b = await register();
		await send(a, b).expect(201);
		const [incoming] = (await requestsOf(b)).incoming;

		await request(server)
			.post(`/api/friends/requests/${incoming?.id}/decline`)
			.set('Cookie', b.cookie)
			.expect(204);

		expect((await requestsOf(a)).outgoing).toEqual([]);
		expect(await friendIdsOf(b)).toEqual([]);
	});

	it('you cannot accept your own request', async () => {
		const a = await register();
		const b = await register();
		await send(a, b).expect(201);
		const [outgoing] = (await requestsOf(a)).outgoing;

		await request(server)
			.post(`/api/friends/requests/${outgoing?.id}/accept`)
			.set('Cookie', a.cookie)
			.expect(404);
	});

	it('the sender cancels with DELETE', async () => {
		const a = await register();
		const b = await register();
		await send(a, b).expect(201);

		await request(server)
			.delete(`/api/friends/${b.user.id}`)
			.set('Cookie', a.cookie)
			.expect(204);

		expect((await requestsOf(b)).incoming).toEqual([]);
	});

	it('remove ends the friendship for both', async () => {
		const a = await register();
		const b = await register();
		await send(a, b).expect(201);
		await send(b, a).expect(201);

		await request(server)
			.delete(`/api/friends/${a.user.id}`)
			.set('Cookie', b.cookie)
			.expect(204);

		expect(await friendIdsOf(a)).toEqual([]);
		expect(await friendIdsOf(b)).toEqual([]);
	});

	it('answers 409 for a second request', async () => {
		const a = await register();
		const b = await register();
		await send(a, b).expect(201);

		await send(a, b).expect(409);
	});

	it('answers 400 for yourself or an id that is not a uuid', async () => {
		const a = await register();

		await send(a, a).expect(400);
		await request(server)
			.post('/api/friends/requests')
			.set('Cookie', a.cookie)
			.send({ userId: 'abc' })
			.expect(400);
		await request(server)
			.post('/api/friends/requests/abc/accept')
			.set('Cookie', a.cookie)
			.expect(400);
	});

	it('answers 404 for a user nobody has', async () => {
		const a = await register();

		await request(server)
			.post('/api/friends/requests')
			.set('Cookie', a.cookie)
			.send({ userId: randomUUID() })
			.expect(404);
	});

	it('refuses a visitor who is not logged in', async () => {
		await request(server).get('/api/friends').expect(401);
		await request(server).get('/api/friends/requests').expect(401);
	});
});
