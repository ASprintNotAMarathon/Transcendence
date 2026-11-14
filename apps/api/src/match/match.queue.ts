import { Injectable } from '@nestjs/common';
import type { GameName } from '@transcendence/shared';

export interface Waiting {
	readonly userId: string;
	readonly game: GameName;
	readonly socketId: string;
}

@Injectable()
export class MatchQueue {
	private readonly waiting: Waiting[] = [];
	private readonly busy = new Set<string>();

	claim(userId: string): boolean {
		if (this.busy.has(userId) || this.indexOfUser(userId) !== -1) {
			return false;
		}
		this.busy.add(userId);
		return true;
	}

	release(userId: string): void {
		this.busy.delete(userId);
	}

	takeFor(game: GameName): Waiting | null {
		const index = this.waiting.findIndex((entry) => entry.game === game);
		if (index === -1) {
			return null;
		}
		const [entry] = this.waiting.splice(index, 1);
		this.busy.add(entry.userId);
		return entry;
	}

	wait(entry: Waiting): void {
		this.waiting.push(entry);
	}

	leave(userId: string): void {
		this.removeAt(this.indexOfUser(userId));
	}

	leaveSocket(socketId: string): void {
		this.removeAt(
			this.waiting.findIndex((entry) => entry.socketId === socketId),
		);
	}

	private indexOfUser(userId: string): number {
		return this.waiting.findIndex((entry) => entry.userId === userId);
	}

	private removeAt(index: number): void {
		if (index !== -1) {
			this.waiting.splice(index, 1);
		}
	}
}
