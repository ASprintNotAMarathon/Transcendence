import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { PUBLIC_USER_SELECT, type PublicUser } from './auth.types';
import type { RegisterDto } from './dto/register.dto';

/** Prisma names its unique indexes <Model>_<field>_key. */
const EMAIL_INDEX = 'User_email_key';
const DISPLAY_NAME_INDEX = 'User_displayName_key';

/**
 * Prisma 7 moved the constraint name out of meta.target, as CONTRIBUTING.md
 * records. This is the only place that knows where it went.
 */
function constraintIndex(
	error: Prisma.PrismaClientKnownRequestError,
): string | undefined {
	const meta = error.meta as
		| {
				driverAdapterError?: {
					cause?: { constraint?: { index?: string } };
				};
		  }
		| undefined;
	return meta?.driverAdapterError?.cause?.constraint?.index;
}

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly passwords: PasswordService,
	) {}

	/**
	 * Creates the account. The duplicate check is the database's unique index
	 * and nothing else: a findUnique first would let two concurrent signups
	 * both read "free" and both insert, and one of them would crash with a 500.
	 *
	 * The cost is that a duplicate registration pays for the argon2 hash before
	 * being rejected. That is the accepted price of not racing.
	 */
	async register(dto: RegisterDto): Promise<PublicUser> {
		const passwordHash = await this.passwords.hash(dto.password);

		try {
			return await this.prisma.user.create({
				data: {
					email: dto.email,
					displayName: dto.displayName,
					passwordHash,
				},
				select: PUBLIC_USER_SELECT,
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				// Keyed by field, so the register form marks the right input.
				// Contract decision 01: a sentence, and the client never reads
				// it — only which field it arrived on.
				const index = constraintIndex(error);
				if (index === EMAIL_INDEX) {
					throw new ConflictException({
						errors: { email: 'That email is already registered' },
					});
				}
				if (index === DISPLAY_NAME_INDEX) {
					throw new ConflictException({
						errors: { displayName: 'That display name is taken' },
					});
				}
			}
			// Anything else, including a P2002 on a constraint this code does
			// not know about, is a real bug. Let it surface as a 500.
			throw error;
		}
	}
}
