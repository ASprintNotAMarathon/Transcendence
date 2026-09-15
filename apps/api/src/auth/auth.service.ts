import { randomBytes } from 'node:crypto';
import {
	ConflictException,
	Injectable,
	UnauthorizedException,
	type OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { PUBLIC_USER_SELECT, type PublicUser } from './auth.types';
import type { LoginDto } from './dto/login.dto';
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
export class AuthService implements OnModuleInit {
	constructor(
		private readonly prisma: PrismaService,
		private readonly passwords: PasswordService,
	) {}

	private dummyHash!: string;

	/**
	 * Hashed once at boot from random bytes. Login verifies against this when
	 * no account matched, so a missing email costs the same as a wrong
	 * password. Random rather than a literal in this file, so it can never
	 * coincide with somebody's real password. Nest awaits this, so the value
	 * is always present before the first request.
	 */
	async onModuleInit(): Promise<void> {
		this.dummyHash = await this.passwords.hash(
			randomBytes(32).toString('hex'),
		);
	}

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

	/**
	 * Exchanges credentials for a user. An unknown email and a wrong password
	 * are deliberately indistinguishable, in the message and in the timing:
	 * returning early when no account exists would answer in about a
	 * millisecond while a wrong password costs an argon2 verify, and that gap
	 * is measurable from outside.
	 */
	async login(dto: LoginDto): Promise<PublicUser> {
		const user = await this.prisma.user.findUnique({
			where: { email: dto.email },
			select: { ...PUBLIC_USER_SELECT, passwordHash: true },
		});

		// verify() throws on a malformed digest rather than returning false,
		// so a rejection has to read as a failed login, not a 500.
		const digest = user?.passwordHash ?? this.dummyHash;
		const ok = await this.passwords
			.verify(digest, dto.password)
			.catch(() => false);

		// One answer for both failure modes. Naming the field would let anyone
		// holding a list of addresses learn which have accounts here.
		if (!user || !ok) {
			throw new UnauthorizedException('Invalid email or password');
		}

		// Rebuilt field by field, because this query also selected the hash.
		return {
			id: user.id,
			email: user.email,
			displayName: user.displayName,
			createdAt: user.createdAt,
		};
	}
}
