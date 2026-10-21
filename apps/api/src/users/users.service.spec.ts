import {
	ConflictException,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
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

/** A Prisma 7 error with the given code, shaped as the client reports it. */
function prismaError(
	code: string,
	meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError('failed', {
		code,
		clientVersion: 'test',
		meta,
	});
}

describe('UsersService.updateDisplayName', () => {
	const update = vi.fn();
	let service: UsersService;

	beforeEach(async () => {
		update.mockReset();

		const moduleRef = await Test.createTestingModule({
			providers: [
				UsersService,
				{ provide: PrismaService, useValue: { user: { update } } },
			],
		}).compile();

		service = moduleRef.get(UsersService);
	});

	it('returns the whole user, as /auth/me does', async () => {
		update.mockResolvedValue({
			...ROW,
			email: 'kimia@example.com',
			displayName: 'renamed',
		});

		await expect(service.updateDisplayName(ID, 'renamed')).resolves.toEqual(
			{
				id: ID,
				email: 'kimia@example.com',
				displayName: 'renamed',
				avatarUrl: null,
				createdAt: ROW.createdAt,
			},
		);
	});

	it('maps a taken name to a 409 naming the displayName field', async () => {
		update.mockRejectedValue(
			prismaError('P2002', {
				driverAdapterError: {
					cause: { constraint: { index: 'User_displayName_key' } },
				},
			}),
		);

		const thrown = await service
			.updateDisplayName(ID, 'taken')
			.catch((e: unknown) => e);

		expect(thrown).toBeInstanceOf(ConflictException);
		expect((thrown as ConflictException).getResponse()).toEqual({
			statusCode: 409,
			error: 'Conflict',
			errors: { displayName: 'That display name is taken' },
		});
	});

	it('answers 401 when the user behind a valid token is gone', async () => {
		update.mockRejectedValue(prismaError('P2025'));

		await expect(
			service.updateDisplayName(ID, 'renamed'),
		).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it('rethrows anything it does not recognise', async () => {
		const failure = new Error('the database is on fire');
		update.mockRejectedValue(failure);

		await expect(service.updateDisplayName(ID, 'renamed')).rejects.toBe(
			failure,
		);
	});
});
