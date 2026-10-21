import {
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { PUBLIC_USER_SELECT, toPublicUser, type PublicUser } from '../auth';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { duplicateOf, uniqueViolationIndex } from '../prisma/unique-violation';
import { DISPLAY_NAME_INDEX, DISPLAY_NAME_TAKEN } from './display-name';
import {
	PUBLIC_PROFILE_SELECT,
	toPublicProfile,
	type PublicProfile,
} from './users.types';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Somebody else's profile. A missing user is a 404 here, unlike /auth/me:
	 * the caller is logged in and simply asked for an id that does not exist.
	 */
	async findProfile(id: string): Promise<PublicProfile> {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: PUBLIC_PROFILE_SELECT,
		});

		if (!user) {
			throw new NotFoundException();
		}

		return toPublicProfile(user);
	}

	/**
	 * Renames the caller and answers with their whole user, the same object
	 * /auth/me returns, so the client can swap it in without asking again.
	 *
	 * No "is it free?" query first: two renames could both read "free" and one
	 * would crash. The unique index decides, and its error becomes the 409.
	 * Renaming to the name you already have collides with nothing.
	 */
	async updateDisplayName(
		userId: string,
		displayName: string,
	): Promise<PublicUser> {
		try {
			const user = await this.prisma.user.update({
				where: { id: userId },
				data: { displayName },
				select: PUBLIC_USER_SELECT,
			});
			return toPublicUser(user);
		} catch (error) {
			if (uniqueViolationIndex(error) === DISPLAY_NAME_INDEX) {
				throw duplicateOf('displayName', DISPLAY_NAME_TAKEN);
			}
			// A valid token whose user is gone: 401, as /auth/me answers.
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				throw new UnauthorizedException();
			}
			throw error;
		}
	}
}
