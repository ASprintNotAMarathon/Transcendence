import { Injectable } from '@nestjs/common';

const NO_SOCKETS: ReadonlySet<string> = new Set();

/**
 * Which socket belongs to which user.
 *
 * One user can hold several sockets at once (a second tab, or a reconnect that briefly
 * overlaps the connection it is replacing). Everything above this layer addresses a user;
 * only this class knows a user is a set of sockets.
 */
@Injectable()
export class WsRegistry {
	private readonly byUser = new Map<string, Set<string>>(); //keys are user IDs, and values are sets of socket IDs

	/**
	 * Record a socket. Returns true if it is the user's first: they just came online,
	 * and presence should know about it.
	 */
	add(userId: string, socketId: string): boolean {
		const existing = this.byUser.get(userId);
		if (existing != undefined) {
			existing.add(socketId);
			return false;
		}
		this.byUser.set(userId, new Set([socketId]));
		return true;
	}

	/**
	 * Forget a socket. Returns true if it was the user's last (they have gone offline).
	 * The user's entry is dropped entirely, so an empty set is never stored and `isOnline`
	 * can be a plain key lookup.
	 */
	remove(userId: string, socketId: string): boolean {
		const sockets = this.byUser.get(userId);
		if (sockets === undefined) {
			return false;
		}

		sockets.delete(socketId);
		if (sockets.size > 0) {
			return false;
		}

		this.byUser.delete(userId);
		return true;
	}

	isOnline(userId: string): boolean {
		return this.byUser.has(userId);
	}

	socketsFor(userId: string): ReadonlySet<string> {
		return this.byUser.get(userId) ?? NO_SOCKETS;
	}
}
