import { beforeEach, describe, expect, it } from 'vitest';
import { MatchQueue } from './match.queue';
import type { Waiting } from './match.queue';

const ALICE: Waiting = {
	userId: 'alice',
	game: 'gomoku',
	socketId: 'alice-tab-1',
};
const BOB: Waiting = {
	userId: 'bob',
	game: 'gomoku',
	socketId: 'bob-tab-1',
};
const CAROL: Waiting = {
	userId: 'carol',
	game: 'reversi',
	socketId: 'carol-tab-1',
};

describe('MatchQueue', () => {
	let queue: MatchQueue;

	beforeEach(() => {
		queue = new MatchQueue();
	});

	describe('claim', () => {
		it('lets a user in who is neither busy nor waiting', () => {
			expect(queue.claim('alice')).toBe(true);
		});

		it('refuses a user whose click is still being handled', () => {
			queue.claim('alice');

			expect(queue.claim('alice')).toBe(false);
		});

		it('refuses a user who is already waiting', () => {
			queue.wait(ALICE);

			expect(queue.claim('alice')).toBe(false);
		});

		it('lets a user in again after release', () => {
			queue.claim('alice');
			queue.release('alice');

			expect(queue.claim('alice')).toBe(true);
		});

		it('does not stop a different user', () => {
			queue.claim('alice');

			expect(queue.claim('bob')).toBe(true);
		});
	});

	describe('takeFor', () => {
		it('is null when nobody is waiting', () => {
			expect(queue.takeFor('gomoku')).toBeNull();
		});

		it('gives the player who has waited longest', () => {
			queue.wait(ALICE);
			queue.wait(BOB);

			expect(queue.takeFor('gomoku')).toEqual(ALICE);
		});

		it('only gives a player waiting for that game', () => {
			queue.wait(CAROL);
			queue.wait(BOB);

			expect(queue.takeFor('gomoku')).toEqual(BOB);
		});

		it('is null when the only players waiting want another game', () => {
			queue.wait(CAROL);

			expect(queue.takeFor('gomoku')).toBeNull();
		});

		it('takes the player out of the queue', () => {
			queue.wait(ALICE);
			queue.takeFor('gomoku');

			expect(queue.takeFor('gomoku')).toBeNull();
		});

		it('marks the player busy until they are released', () => {
			queue.wait(ALICE);
			queue.takeFor('gomoku');

			expect(queue.claim('alice')).toBe(false);
			queue.release('alice');
			expect(queue.claim('alice')).toBe(true);
		});
	});

	describe('leave', () => {
		it('takes the user out of the queue', () => {
			queue.wait(ALICE);
			queue.leave('alice');

			expect(queue.takeFor('gomoku')).toBeNull();
		});

		it('leaves everyone else in place', () => {
			queue.wait(ALICE);
			queue.wait(BOB);
			queue.leave('alice');

			expect(queue.takeFor('gomoku')).toEqual(BOB);
		});

		it('does nothing for a user who is not waiting', () => {
			queue.wait(BOB);
			queue.leave('alice');

			expect(queue.takeFor('gomoku')).toEqual(BOB);
		});
	});

	describe('leaveSocket', () => {
		it('takes out the user whose Play tab closed', () => {
			queue.wait(ALICE);
			queue.leaveSocket('alice-tab-1');

			expect(queue.takeFor('gomoku')).toBeNull();
		});

		it('keeps the user waiting when one of their other tabs closes', () => {
			queue.wait(ALICE);
			queue.leaveSocket('alice-tab-2');

			expect(queue.takeFor('gomoku')).toEqual(ALICE);
		});

		it('leaves everyone else in place', () => {
			queue.wait(ALICE);
			queue.wait(BOB);
			queue.leaveSocket('alice-tab-1');

			expect(queue.takeFor('gomoku')).toEqual(BOB);
		});
	});
});
