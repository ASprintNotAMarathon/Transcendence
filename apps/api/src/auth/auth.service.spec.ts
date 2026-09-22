import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import type { RegisterDto } from './dto/register.dto';

const DTO: RegisterDto = {
	email: 'kimia@example.com',
	displayName: 'kimia',
	password: 'correct-horse-battery-staple',
};

const HASH = '$argon2id$stub';

const CREATED = {
	id: '3f1c2e88-9a4b-4c7d-8e21-5b6f0d9a1c33',
	email: DTO.email,
	displayName: DTO.displayName,
	createdAt: new Date('2026-09-15T09:13:38.486Z'),
};

/**
 * A unique violation shaped the way Prisma 7 reports one. If Prisma ever moves
 * the constraint name again, this helper and the service disagree and these
 * tests go red, which is the earliest anyone could find out.
 */
function uniqueViolation(index: string): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError(
		'Unique constraint failed',
		{
			code: 'P2002',
			clientVersion: 'test',
			meta: { driverAdapterError: { cause: { constraint: { index } } } },
		},
	);
}

describe('AuthService.register', () => {
	const create = vi.fn();
	let service: AuthService;

	beforeEach(async () => {
		create.mockReset();

		const moduleRef = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: PrismaService, useValue: { user: { create } } },
				// Hashing is deliberately slow and has its own spec, so it is
				// stubbed here. These tests are about mapping the failure.
				{
					provide: PasswordService,
					useValue: {
						hash: () => Promise.resolve(HASH),
						verify: () => Promise.resolve(true),
					},
				},
			],
		}).compile();

		service = moduleRef.get(AuthService);
	});

	it('stores the hash and never the password itself', async () => {
		create.mockResolvedValue(CREATED);

		await expect(service.register(DTO)).resolves.toEqual(CREATED);

		const [args] = create.mock.calls[0] as [{ data: RegisterDto }];
		expect(args.data).toMatchObject({
			email: DTO.email,
			displayName: DTO.displayName,
			passwordHash: HASH,
		});
		expect(args.data).not.toHaveProperty('password');
	});

	it('maps a duplicate email to a 409 naming the email', async () => {
		create.mockRejectedValue(uniqueViolation('User_email_key'));

		const thrown = await service.register(DTO).catch((e: unknown) => e);

		expect(thrown).toBeInstanceOf(ConflictException);
		expect((thrown as ConflictException).getResponse()).toEqual({
			statusCode: 409,
			error: 'Conflict',
			errors: { email: 'That email is already registered' },
		});
	});

	it('maps a duplicate display name to a 409 naming the display name', async () => {
		create.mockRejectedValue(uniqueViolation('User_displayName_key'));

		const thrown = await service.register(DTO).catch((e: unknown) => e);

		expect(thrown).toBeInstanceOf(ConflictException);
		expect((thrown as ConflictException).getResponse()).toEqual({
			statusCode: 409,
			error: 'Conflict',
			errors: { displayName: 'That display name is taken' },
		});
	});

	it('rethrows a unique violation on a constraint it does not map', async () => {
		const violation = uniqueViolation('User_somethingElse_key');
		create.mockRejectedValue(violation);

		// Surfacing as a 500 is correct: it means a constraint exists that this
		// code has never heard of, which is a bug to see rather than smother.
		await expect(service.register(DTO)).rejects.toBe(violation);
	});

	it('rethrows anything that is not a unique violation', async () => {
		const failure = new Error('the database is on fire');
		create.mockRejectedValue(failure);

		await expect(service.register(DTO)).rejects.toBe(failure);
	});
});
