import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueViolationIndex } from '../prisma/unique-violation';
import { PUBLIC_PROFILE_SELECT, toPublicProfile } from '../users/users.types';
import { WsRegistry } from '../ws/ws.registry';
import {
	orderedPair,
	type Friend,
	type FriendRequests,
	type FriendshipState,
} from './friends.types';

/** The unique index from the migration: one row per pair. */
const PAIR_INDEX = 'Friendship_user0Id_user1Id_key';

/** Load both users with the profile fields only, never the email. */
const BOTH_USERS = {
	user0: { select: PUBLIC_PROFILE_SELECT },
	user1: { select: PUBLIC_PROFILE_SELECT },
} as const;

/** Rows I am in, on either side. */
function mine(me: string) {
	return { OR: [{ user0Id: me }, { user1Id: me }] };
}

/** Whichever of the two users is not me. */
function otherUser<T>(
	row: { user0Id: string; user0: T; user1: T },
	me: string,
): T {
	return row.user0Id === me ? row.user1 : row.user0;
}

/**
 * A pending request that someone else sent to me. Accept and decline only
 * touch rows that match all of this, so you cannot accept your own request
 * or someone else's.
 */
function incomingRequest(me: string, requestId: string) {
	return {
		id: requestId,
		status: 'pending' as const,
		requesterId: { not: me },
		...mine(me),
	};
}

@Injectable()
export class FriendsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly registry: WsRegistry,
	) {}

	/** My friends, sorted by name, each with whether they are online now. */
	async listFriends(me: string): Promise<Friend[]> {
		const rows = await this.prisma.friendship.findMany({
			where: { status: 'accepted', ...mine(me) },
			include: BOTH_USERS,
		});

		return rows
			.map((row) => {
				const friend = toPublicProfile(otherUser(row, me));
				return { ...friend, online: this.registry.isOnline(friend.id) };
			})
			.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}

	/**
	 * Only friends see whether you are online. Anyone else, and you on
	 * your own profile, gets false.
	 */
	isOnlineFor(state: FriendshipState, userId: string): boolean {
		return state === 'friends' && this.registry.isOnline(userId);
	}

	/** Pending requests, split by who sent them. Newest first. */
	async listRequests(me: string): Promise<FriendRequests> {
		const rows = await this.prisma.friendship.findMany({
			where: { status: 'pending', ...mine(me) },
			include: BOTH_USERS,
			orderBy: { createdAt: 'desc' },
		});

		const requests: FriendRequests = { incoming: [], outgoing: [] };
		for (const row of rows) {
			const request = {
				id: row.id,
				user: toPublicProfile(otherUser(row, me)),
				createdAt: row.createdAt,
			};
			if (row.requesterId === me) {
				requests.outgoing.push(request);
			} else {
				requests.incoming.push(request);
			}
		}
		return requests;
	}

	/**
	 * How I relate to another user, for the button on their profile.
	 * One indexed lookup on the pair.
	 */
	async stateBetween(me: string, otherId: string): Promise<FriendshipState> {
		if (me === otherId) {
			return 'self';
		}

		const row = await this.prisma.friendship.findUnique({
			where: { user0Id_user1Id: orderedPair(me, otherId) },
			select: { status: true, requesterId: true },
		});

		if (!row) {
			return 'none';
		}
		if (row.status === 'accepted') {
			return 'friends';
		}
		return row.requesterId === me ? 'requested' : 'incoming';
	}

	/**
	 * Sends a request and answers with the new state. If they already
	 * asked me, this accepts theirs instead of failing.
	 */
	async sendRequest(me: string, otherId: string): Promise<FriendshipState> {
		if (me === otherId) {
			throw new BadRequestException('You cannot add yourself');
		}

		const other = await this.prisma.user.findUnique({
			where: { id: otherId },
			select: { id: true },
		});
		if (!other) {
			throw new NotFoundException();
		}

		const pair = orderedPair(me, otherId);
		const existing = await this.prisma.friendship.findUnique({
			where: { user0Id_user1Id: pair },
		});

		if (existing?.status === 'accepted') {
			throw new ConflictException('Already friends');
		}
		if (existing?.requesterId === me) {
			throw new ConflictException('Request already sent');
		}
		if (existing) {
			// They asked me first: sending one back means yes.
			await this.prisma.friendship.update({
				where: { id: existing.id },
				data: { status: 'accepted' },
			});
			return 'friends';
		}

		try {
			await this.prisma.friendship.create({
				data: { ...pair, requesterId: me },
			});
		} catch (error) {
			// Both sent at the same moment: the unique index lets only one in.
			if (uniqueViolationIndex(error) === PAIR_INDEX) {
				throw new ConflictException('Request already sent');
			}
			throw error;
		}
		return 'requested';
	}

	async accept(me: string, requestId: string): Promise<void> {
		const { count } = await this.prisma.friendship.updateMany({
			where: incomingRequest(me, requestId),
			data: { status: 'accepted' },
		});
		if (count === 0) {
			throw new NotFoundException();
		}
	}

	async decline(me: string, requestId: string): Promise<void> {
		const { count } = await this.prisma.friendship.deleteMany({
			where: incomingRequest(me, requestId),
		});
		if (count === 0) {
			throw new NotFoundException();
		}
	}

	/**
	 * Removes a friend, or cancels a request I sent. A request someone sent
	 * to me is not touched here: that is decline.
	 */
	async remove(me: string, otherId: string): Promise<void> {
		const { count } = await this.prisma.friendship.deleteMany({
			where: {
				...orderedPair(me, otherId),
				OR: [{ status: 'accepted' }, { requesterId: me }],
			},
		});
		if (count === 0) {
			throw new NotFoundException();
		}
	}
}
