import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from './friends.service';

// Chosen so ALICE < ME < OTHER: ME is user0 next to OTHER, user1 next to ALICE.
const ALICE = '00000000-0000-4000-8000-000000000000';
const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const CREATED = new Date('2026-11-01T10:00:00.000Z');

/** The row Prisma hands back for PUBLIC_PROFILE_SELECT. */
function profile(id: string, displayName: string) {
	return { id, displayName, avatarPath: null, createdAt: CREATED };
}

const prisma = {
	user: { findUnique: vi.fn() },
	friendship: {
		findMany: vi.fn(),
		findUnique: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		updateMany: vi.fn(),
		deleteMany: vi.fn(),
	},
};

let service: FriendsService;

beforeEach(async () => {
	vi.resetAllMocks();
	const moduleRef = await Test.createTestingModule({
		providers: [
			FriendsService,
			{ provide: PrismaService, useValue: prisma },
		],
	}).compile();
	service = moduleRef.get(FriendsService);
});

describe('FriendsService.listFriends', () => {
	it('returns the other person, whichever side I am on, sorted by name', async () => {
		prisma.friendship.findMany.mockResolvedValue([
			{
				user0Id: ME,
				user0: profile(ME, 'me'),
				user1: profile(OTHER, 'zed'),
			},
			{
				user0Id: ALICE,
				user0: profile(ALICE, 'alice'),
				user1: profile(ME, 'me'),
			},
		]);

		const friends = await service.listFriends(ME);

		expect(friends.map((f) => f.displayName)).toEqual(['alice', 'zed']);
		expect(friends[0]).not.toHaveProperty('email');
	});
});

describe('FriendsService.listRequests', () => {
	it('splits requests by who sent them', async () => {
		prisma.friendship.findMany.mockResolvedValue([
			{
				id: 'a',
				requesterId: ME,
				createdAt: CREATED,
				user0Id: ME,
				user0: profile(ME, 'me'),
				user1: profile(OTHER, 'other'),
			},
			{
				id: 'b',
				requesterId: ALICE,
				createdAt: CREATED,
				user0Id: ALICE,
				user0: profile(ALICE, 'alice'),
				user1: profile(ME, 'me'),
			},
		]);

		const requests = await service.listRequests(ME);

		expect(requests.outgoing.map((r) => r.user.displayName)).toEqual([
			'other',
		]);
		expect(requests.incoming.map((r) => r.user.displayName)).toEqual([
			'alice',
		]);
	});
});

describe('FriendsService.sendRequest', () => {
	beforeEach(() => {
		prisma.user.findUnique.mockResolvedValue({ id: OTHER });
	});

	it('refuses to add yourself', async () => {
		await expect(service.sendRequest(ME, ME)).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});

	it('answers 404 for a user nobody has', async () => {
		prisma.user.findUnique.mockResolvedValue(null);

		await expect(service.sendRequest(ME, OTHER)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('creates a pending row with the smaller id first', async () => {
		prisma.friendship.findUnique.mockResolvedValue(null);

		await expect(service.sendRequest(OTHER, ME)).resolves.toBe('requested');
		expect(prisma.friendship.create).toHaveBeenCalledWith({
			data: { user0Id: ME, user1Id: OTHER, requesterId: OTHER },
		});
	});

	it('answers 409 when already friends', async () => {
		prisma.friendship.findUnique.mockResolvedValue({ status: 'accepted' });

		await expect(service.sendRequest(ME, OTHER)).rejects.toBeInstanceOf(
			ConflictException,
		);
	});

	it('answers 409 when I already sent one', async () => {
		prisma.friendship.findUnique.mockResolvedValue({
			status: 'pending',
			requesterId: ME,
		});

		await expect(service.sendRequest(ME, OTHER)).rejects.toBeInstanceOf(
			ConflictException,
		);
	});

	it('accepts their request when they already asked me', async () => {
		prisma.friendship.findUnique.mockResolvedValue({
			id: REQUEST_ID,
			status: 'pending',
			requesterId: OTHER,
		});

		await expect(service.sendRequest(ME, OTHER)).resolves.toBe('friends');
		expect(prisma.friendship.update).toHaveBeenCalledWith({
			where: { id: REQUEST_ID },
			data: { status: 'accepted' },
		});
		expect(prisma.friendship.create).not.toHaveBeenCalled();
	});

	it('answers 409 when two requests race into the unique index', async () => {
		prisma.friendship.findUnique.mockResolvedValue(null);
		prisma.friendship.create.mockRejectedValue(
			new Prisma.PrismaClientKnownRequestError('failed', {
				code: 'P2002',
				clientVersion: 'test',
				meta: {
					driverAdapterError: {
						cause: {
							constraint: {
								index: 'Friendship_user0Id_user1Id_key',
							},
						},
					},
				},
			}),
		);

		await expect(service.sendRequest(ME, OTHER)).rejects.toBeInstanceOf(
			ConflictException,
		);
	});
});

describe('FriendsService.accept and decline', () => {
	it('only touches a pending request someone else sent to me', async () => {
		prisma.friendship.updateMany.mockResolvedValue({ count: 1 });

		await service.accept(ME, REQUEST_ID);

		expect(prisma.friendship.updateMany).toHaveBeenCalledWith({
			where: {
				id: REQUEST_ID,
				status: 'pending',
				requesterId: { not: ME },
				OR: [{ user0Id: ME }, { user1Id: ME }],
			},
			data: { status: 'accepted' },
		});
	});

	it('accept answers 404 when nothing matched', async () => {
		prisma.friendship.updateMany.mockResolvedValue({ count: 0 });

		await expect(service.accept(ME, REQUEST_ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('decline answers 404 when nothing matched', async () => {
		prisma.friendship.deleteMany.mockResolvedValue({ count: 0 });

		await expect(service.decline(ME, REQUEST_ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});

describe('FriendsService.remove', () => {
	it('deletes a friendship or my own request, never theirs', async () => {
		prisma.friendship.deleteMany.mockResolvedValue({ count: 1 });

		await service.remove(OTHER, ME);

		expect(prisma.friendship.deleteMany).toHaveBeenCalledWith({
			where: {
				user0Id: ME,
				user1Id: OTHER,
				OR: [{ status: 'accepted' }, { requesterId: OTHER }],
			},
		});
	});

	it('answers 404 when there is nothing to remove', async () => {
		prisma.friendship.deleteMany.mockResolvedValue({ count: 0 });

		await expect(service.remove(ME, OTHER)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});
