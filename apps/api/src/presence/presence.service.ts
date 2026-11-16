import { Injectable } from '@nestjs/common';
import type { PresenceUser } from '@transcendence/shared';
import { PrismaService } from '../prisma/prisma.service';
import { avatarUrl } from '../users/avatar';
import { WsRegistry } from '../ws/ws.registry';

/**
 * Who is online, for every player: the lobby list, the presence events,
 * and the online field on a profile.
 */
@Injectable()
export class PresenceService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly registry: WsRegistry,
	) {}

	/** Whether the user has a socket open right now. Visible to every player. */
	isOnline(userId: string): boolean {
		return this.registry.isOnline(userId);
	}

	/** How the presence events show a user. Null if they are gone. */
	async presenceUser(userId: string): Promise<PresenceUser | null> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { displayName: true, avatarPath: true },
		});
		return user
			? {
					userId,
					displayName: user.displayName,
					avatarUrl: avatarUrl(user.avatarPath),
				}
			: null;
	}

	/** Several users at once, sorted by name. Ids that no longer exist are skipped. */
	async presenceUsers(ids: readonly string[]): Promise<PresenceUser[]> {
		if (ids.length === 0) {
			return [];
		}
		const users = await this.prisma.user.findMany({
			where: { id: { in: [...ids] } },
			select: { id: true, displayName: true, avatarPath: true },
			orderBy: { displayName: 'asc' },
		});
		return users.map((user) => ({
			userId: user.id,
			displayName: user.displayName,
			avatarUrl: avatarUrl(user.avatarPath),
		}));
	}
}
