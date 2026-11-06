import type { PublicProfile } from '../users/users.types';

/** What the profile button shows. `self` is your own profile. */
export type FriendshipState =
	'none' | 'requested' | 'incoming' | 'friends' | 'self';

/** A pending request, seen from my side: `user` is always the other person. */
export type FriendRequest = {
	id: string;
	user: PublicProfile;
	createdAt: Date;
};

export type FriendRequests = {
	incoming: FriendRequest[];
	outgoing: FriendRequest[];
};

/**
 * Smaller id first, the same order the table stores them in,
 * so A+B and B+A always find the same row.
 */
export function orderedPair(
	a: string,
	b: string,
): { user0Id: string; user1Id: string } {
	return a < b ? { user0Id: a, user1Id: b } : { user0Id: b, user1Id: a };
}
