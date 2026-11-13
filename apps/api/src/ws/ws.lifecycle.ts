import { Injectable, Logger } from '@nestjs/common';

export type WsPresenceListener = (userId: string) => void | Promise<void>;

/** Who is connected.*/
@Injectable()
export class WsLifecycle {
	private readonly logger = new Logger(WsLifecycle.name);

	private readonly online = new Set<WsPresenceListener>();
	private readonly offline = new Set<WsPresenceListener>();

	onUserOnline(listener: WsPresenceListener): () => void {
		this.online.add(listener);
		return () => this.online.delete(listener);
	}

	onUserOffline(listener: WsPresenceListener): () => void {
		this.offline.add(listener);
		return () => this.offline.delete(listener);
	}

	userOnline(userId: string): void {
		this.fire(this.online, userId, 'online');
	}

	userOffline(userId: string): void {
		this.fire(this.offline, userId, 'offline');
	}

	private fire(
		listeners: ReadonlySet<WsPresenceListener>,
		userId: string,
		what: string,
	): void {
		for (const listener of listeners) {
			try {
				Promise.resolve(listener(userId)).catch((error: unknown) => {
					this.logger.error(
						`${what} listener failed for ${userId}`,
						error,
					);
				});
			} catch (error) {
				this.logger.error(
					`${what} listener threw for ${userId}`,
					error,
				);
			}
		}
	}
}
