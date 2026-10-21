import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const ID = '3f1c2e88-9a4b-4c7d-8e21-5b6f0d9a1c33';

/**
 * The service with a stubbed user table. The folder is only touched by the
 * avatar tests, which pass a real temporary one.
 */
async function buildService(
	user: Record<string, unknown>,
	avatarDir = '/nowhere',
): Promise<UsersService> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			UsersService,
			{ provide: PrismaService, useValue: { user } },
			{ provide: ConfigService, useValue: { get: () => avatarDir } },
		],
	}).compile();

	return moduleRef.get(UsersService);
}

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
		service = await buildService({ findUnique });
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
		service = await buildService({ update });
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

describe('UsersService.updateAvatar', () => {
	const findUnique = vi.fn();
	const update = vi.fn();
	let service: UsersService;
	let dir: string;

	/** The smallest thing detectImageType accepts as a PNG. */
	const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

	/** What update returns once the new name is stored. */
	function storedWith(avatarPath: string) {
		return { ...ROW, email: 'kimia@example.com', avatarPath };
	}

	beforeEach(async () => {
		findUnique.mockReset();
		update.mockReset();
		dir = await mkdtemp(join(tmpdir(), 'avatars-'));
		service = await buildService({ findUnique, update }, dir);
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	/** The 400 body, keyed by the avatar field like any form error. */
	async function rejection(bytes: Buffer | undefined): Promise<unknown> {
		const thrown = await service
			.updateAvatar(ID, bytes)
			.catch((e: unknown) => e);
		expect(thrown).toBeInstanceOf(BadRequestException);
		return (thrown as BadRequestException).getResponse();
	}

	it('refuses a request with no file, on the avatar field', async () => {
		expect(await rejection(undefined)).toEqual({
			statusCode: 400,
			error: 'Bad Request',
			errors: { avatar: 'Choose an image to upload' },
		});
	});

	it('refuses bytes that are not an allowed image, and writes nothing', async () => {
		expect(await rejection(Buffer.from('<svg/>'))).toEqual({
			statusCode: 400,
			error: 'Bad Request',
			errors: { avatar: 'Only JPEG, PNG or WebP images are allowed' },
		});
		expect(await readdir(dir)).toEqual([]);
		expect(update).not.toHaveBeenCalled();
	});

	it('saves under a generated name with the detected extension', async () => {
		findUnique.mockResolvedValue({ avatarPath: null });
		update.mockImplementation(
			({ data }: { data: { avatarPath: string } }) =>
				Promise.resolve(storedWith(data.avatarPath)),
		);

		const user = await service.updateAvatar(ID, PNG);

		const [saved] = await readdir(dir);
		expect(saved).toMatch(/^[0-9a-f-]{36}\.png$/);
		expect(user.avatarUrl).toBe(`/api/avatars/${saved}`);
	});

	it('removes the previous file once the new one is stored', async () => {
		await writeFile(join(dir, 'old.png'), PNG);
		findUnique.mockResolvedValue({ avatarPath: 'old.png' });
		update.mockImplementation(
			({ data }: { data: { avatarPath: string } }) =>
				Promise.resolve(storedWith(data.avatarPath)),
		);

		await service.updateAvatar(ID, PNG);

		const files = await readdir(dir);
		expect(files).toHaveLength(1);
		expect(files).not.toContain('old.png');
	});

	it('keeps the previous file and removes the new one if the update fails', async () => {
		await writeFile(join(dir, 'old.png'), PNG);
		findUnique.mockResolvedValue({ avatarPath: 'old.png' });
		const failure = new Error('the database is on fire');
		update.mockRejectedValue(failure);

		await expect(service.updateAvatar(ID, PNG)).rejects.toBe(failure);

		expect(await readdir(dir)).toEqual(['old.png']);
	});

	it('answers 401 and writes nothing when the user is gone', async () => {
		findUnique.mockResolvedValue(null);

		await expect(service.updateAvatar(ID, PNG)).rejects.toBeInstanceOf(
			UnauthorizedException,
		);
		expect(await readdir(dir)).toEqual([]);
	});
});
