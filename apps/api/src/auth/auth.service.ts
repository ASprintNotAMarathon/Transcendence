import { randomBytes } from 'node:crypto';
import {
	Injectable,
	UnauthorizedException,
	type OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { duplicateOf, uniqueViolationIndex } from '../prisma/unique-violation';
import { DISPLAY_NAME_INDEX, DISPLAY_NAME_TAKEN } from '../users/display-name';
import { PasswordService } from './password.service';
import {
	PUBLIC_USER_SELECT,
	toPublicUser,
	type JwtPayload,
	type PublicUser,
} from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

/** Prisma names its unique indexes <Model>_<field>_key. */
const EMAIL_INDEX = 'User_email_key';

@Injectable()
export class AuthService implements OnModuleInit {
	constructor(
		private readonly prisma: PrismaService,
		private readonly passwords: PasswordService,
		private readonly jwt: JwtService,
	) {}

	/**
	 * The one place a token is checked. The HTTP guard calls it, and so does
	 * the socket handshake, so the signing secret and the verification options
	 * live here rather than in two verifiers that drift apart.
	 *
	 * Returns the user id, or null. No exception, because the two callers
	 * refuse differently: the guard answers 401, and the handshake has no
	 * response to put a status in and closes the connection instead. Each
	 * layer owns its own refusal.
	 *
	 * Synchronous on purpose. Checking a signature and an expiry is pure
	 * computation, and decision 05 leaves no database lookup in the path. If
	 * revocation is ever added, that stops being true and this signature has
	 * to change along with both callers.
	 */
	verifyToken(token: string): string | null {
		try {
			return this.jwt.verify<JwtPayload>(token).sub;
		} catch {
			// Expired, tampered, signed with another key, or not a token at
			// all. The caller does not get to tell them apart.
			return null;
		}
	}

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
			const user = await this.prisma.user.create({
				data: {
					email: dto.email,
					displayName: dto.displayName,
					passwordHash,
				},
				select: PUBLIC_USER_SELECT,
			});
			return toPublicUser(user);
		} catch (error) {
			// Keyed by field, so the register form marks the right input.
			// Contract decision 01: a sentence, and the client never reads
			// it — only which field it arrived on.
			const index = uniqueViolationIndex(error);
			if (index === EMAIL_INDEX) {
				throw duplicateOf('email', 'That email is already registered');
			}
			if (index === DISPLAY_NAME_INDEX) {
				throw duplicateOf('displayName', DISPLAY_NAME_TAKEN);
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

		// This query also selected the hash. toPublicUser copies only the
		// public fields, so it stays behind.
		return toPublicUser(user);
	}

	/**
	 * Answers "who is this request from?". The token carries only an id, so the
	 * profile is read fresh every time and a rename shows up immediately rather
	 * than at the caller's next login.
	 *
	 * A valid token whose user no longer exists answers 401, not 404. There is
	 * no revocation, so such a token keeps verifying until it expires and this
	 * lookup is the only thing that catches it. A 404 would tell the browser it
	 * is authenticated as somebody who does not exist, which no client can act
	 * on; 401 says the thing that is actually true.
	 */
	async profile(userId: string): Promise<PublicUser> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: PUBLIC_USER_SELECT,
		});

		if (!user) {
			throw new UnauthorizedException();
		}

		return toPublicUser(user);
	}
}
