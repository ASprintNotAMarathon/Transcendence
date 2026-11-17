import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { WsRegistry } from '../ws/ws.registry';
import { PresenceService } from './presence.service';

const ALICE = '00000000-0000-4000-8000-000000000000';
const OTHER = '22222222-2222-4222-8222-222222222222';

const prisma = { user: { findUnique: vi.fn(), findMany: vi.fn() } };

/** Who has a socket open. Every test says who is online. */
const registry = { isOnline: vi.fn() };

let service: PresenceService;

beforeEach(async () => {
	vi.resetAllMocks();
	const moduleRef = await Test.createTestingModule({
		providers: [
			PresenceService,
			{ provide: PrismaService, useValue: prisma },
			{ provide: WsRegistry, useValue: registry },
		],
	}).compile();
	service = moduleRef.get(PresenceService);
});

describe('PresenceService.isOnline', () => {
	it('is what the socket registry says, friend or not', () => {
		registry.isOnline.mockReturnValue(true);
		expect(service.isOnline(OTHER)).toBe(true);

		registry.isOnline.mockReturnValue(false);
		expect(service.isOnline(OTHER)).toBe(false);

		expect(registry.isOnline).toHaveBeenCalledWith(OTHER);
	});
});

describe('PresenceService.presenceUser', () => {
	it('names the user and turns their avatar file into a URL', async () => {
		prisma.user.findUnique.mockResolvedValue({
			displayName: 'zed',
			avatarPath: 'zed.png',
		});

		await expect(service.presenceUser(OTHER)).resolves.toEqual({
			userId: OTHER,
			displayName: 'zed',
			avatarUrl: '/api/avatars/zed.png',
		});
	});

	it('is null for a user nobody has', async () => {
		prisma.user.findUnique.mockResolvedValue(null);

		await expect(service.presenceUser(OTHER)).resolves.toBeNull();
	});
});

describe('PresenceService.presenceUsers', () => {
	it('loads those ids in one query, sorted by name, with avatar URLs', async () => {
		prisma.user.findMany.mockResolvedValue([
			{ id: ALICE, displayName: 'alice', avatarPath: null },
			{ id: OTHER, displayName: 'zed', avatarPath: 'zed.png' },
		]);

		await expect(service.presenceUsers([OTHER, ALICE])).resolves.toEqual([
			{ userId: ALICE, displayName: 'alice', avatarUrl: null },
			{
				userId: OTHER,
				displayName: 'zed',
				avatarUrl: '/api/avatars/zed.png',
			},
		]);
		expect(prisma.user.findMany).toHaveBeenCalledWith({
			where: { id: { in: [OTHER, ALICE] } },
			select: { id: true, displayName: true, avatarPath: true },
			orderBy: { displayName: 'asc' },
		});
	});

	it('is empty without asking the database when nobody is online', async () => {
		await expect(service.presenceUsers([])).resolves.toEqual([]);
		expect(prisma.user.findMany).not.toHaveBeenCalled();
	});
});
