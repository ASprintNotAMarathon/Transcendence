import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const ID = '3f1c2e88-9a4b-4c7d-8e21-5b6f0d9a1c33';

/** The row Prisma hands back for PUBLIC_PROFILE_SELECT. */
const ROW = {
	id: ID,
	displayName: 'kimia',
	avatarPath: null,
	createdAt: new Date('2026-09-15T09:13:38.486Z'),
};

describe('UsersService.findProfile', () => {
	const findUnique = vi.fn();
	let service: UsersService;

	beforeEach(async () => {
		findUnique.mockReset();

		const moduleRef = await Test.createTestingModule({
			providers: [
				UsersService,
				{ provide: PrismaService, useValue: { user: { findUnique } } },
			],
		}).compile();

		service = moduleRef.get(UsersService);
	});

	it('never asks the database for the email', async () => {
		findUnique.mockResolvedValue(ROW);

		await service.findProfile(ID);

		const query = findUnique.mock.calls[0]?.[0] as {
			select: Record<string, boolean>;
		};
		expect(query.select).not.toHaveProperty('email');
		expect(query.select).not.toHaveProperty('passwordHash');
	});

	it('returns the profile with the avatar as a URL', async () => {
		findUnique.mockResolvedValue({ ...ROW, avatarPath: 'a1b2c3.webp' });

		await expect(service.findProfile(ID)).resolves.toEqual({
			id: ID,
			displayName: 'kimia',
			avatarUrl: '/api/avatars/a1b2c3.webp',
			createdAt: ROW.createdAt,
		});
	});

	it('answers 404 for an id nobody has', async () => {
		findUnique.mockResolvedValue(null);

		await expect(service.findProfile(ID)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});
