import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type {
	MatchDisconnectedPayload,
	PlayerIndex,
} from '@transcendence/shared';

export const GRACE_MS = 30_000;

interface Pending {
	readonly matchId: string;
	readonly player: PlayerIndex;
	readonly deadline: string;
	readonly timer: NodeJS.Timeout;
}

/** Who the server is still waiting for, and until when. */
@Injectable()
export class MatchDisconnects implements OnModuleDestroy {
	private readonly byUser = new Map<string, Pending>();

	start(
		userId: string,
		matchId: string,
		player: PlayerIndex,
		onExpiry: () => void,
	): MatchDisconnectedPayload {
		this.cancel(userId);

		const deadline = new Date(Date.now() + GRACE_MS).toISOString();
		const timer = setTimeout(() => {
			this.byUser.delete(userId);
			onExpiry();
		}, GRACE_MS);

		this.byUser.set(userId, { matchId, player, deadline, timer });
		return { matchId, player, deadline };
	}

	cancel(userId: string): MatchDisconnectedPayload | null {
		const pending = this.byUser.get(userId);
		if (pending === undefined) {
			return null;
		}

		clearTimeout(pending.timer);
		this.byUser.delete(userId);
		return {
			matchId: pending.matchId,
			player: pending.player,
			deadline: pending.deadline,
		};
	}

	/** The soonest deadline on this match, since both players can be gone at once. */
	forMatch(matchId: string): MatchDisconnectedPayload | null {
		let soonest: Pending | undefined;

		for (const pending of this.byUser.values()) {
			if (pending.matchId !== matchId) {
				continue;
			}
			if (soonest === undefined || pending.deadline < soonest.deadline) {
				soonest = pending;
			}
		}

		return soonest === undefined
			? null
			: {
					matchId,
					player: soonest.player,
					deadline: soonest.deadline,
				};
	}

	onModuleDestroy(): void {
		for (const pending of this.byUser.values()) {
			clearTimeout(pending.timer);
		}
		this.byUser.clear();
	}
}
