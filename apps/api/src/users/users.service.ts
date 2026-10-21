import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}
