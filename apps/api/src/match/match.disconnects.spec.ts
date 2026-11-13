import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRACE_MS, MatchDisconnects } from './match.disconnects';

const MATCH_ID = 'match-uuid';
const OTHER_MATCH_ID = 'other-match-uuid';
const PLAYER_0_ID = 'player-0-uuid';
const PLAYER_1_ID = 'player-1-uuid';

describe('MatchDisconnects', () => {
	let book: MatchDisconnects;

	beforeEach(() => {
		vi.useFakeTimers();
		book = new MatchDisconnects();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('reports the match, the seat and a deadline one grace period out', () => {
		vi.setSystemTime(new Date('2026-11-06T12:00:00.000Z'));

		const pending = book.start(PLAYER_0_ID, MATCH_ID, 0, vi.fn());

		expect(pending).toEqual({
			matchId: MATCH_ID,
			player: 0,
			deadline: '2026-11-06T12:00:30.000Z',
		});
	});

	it('calls back once the grace period has passed', () => {
		const onExpiry = vi.fn();
		book.start(PLAYER_0_ID, MATCH_ID, 0, onExpiry);

		vi.advanceTimersByTime(GRACE_MS - 1);
		expect(onExpiry).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(onExpiry).toHaveBeenCalledOnce();
	});

	it('forgets the entry before calling back, so nothing looks still pending', () => {
		const seenDuringExpiry = vi.fn();
		book.start(PLAYER_0_ID, MATCH_ID, 0, () => {
			seenDuringExpiry(book.forMatch(MATCH_ID));
		});

		vi.advanceTimersByTime(GRACE_MS);

		expect(seenDuringExpiry).toHaveBeenCalledWith(null);
	});

	it('cancel stops the callback and hands back what was pending', () => {
		const onExpiry = vi.fn();
		book.start(PLAYER_0_ID, MATCH_ID, 1, onExpiry);

		const cancelled = book.cancel(PLAYER_0_ID);

		vi.advanceTimersByTime(GRACE_MS * 2);
		expect(onExpiry).not.toHaveBeenCalled();
		expect(cancelled).toMatchObject({ matchId: MATCH_ID, player: 1 });
	});

	it('cancel answers null for a user who was never gone', () => {
		expect(book.cancel(PLAYER_0_ID)).toBeNull();
	});

	it('replaces an earlier entry for the same user without leaving its timer armed', () => {
		const first = vi.fn();
		const second = vi.fn();

		book.start(PLAYER_0_ID, MATCH_ID, 0, first);
		book.start(PLAYER_0_ID, MATCH_ID, 0, second);

		vi.advanceTimersByTime(GRACE_MS);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
	});

	it('finds nothing for a match nobody dropped out of', () => {
		book.start(PLAYER_0_ID, OTHER_MATCH_ID, 0, vi.fn());

		expect(book.forMatch(MATCH_ID)).toBeNull();
	});

	it('reports the soonest deadline when both players are gone', () => {
		vi.setSystemTime(new Date('2026-11-06T12:00:00.000Z'));
		book.start(PLAYER_0_ID, MATCH_ID, 0, vi.fn());

		vi.advanceTimersByTime(5000);
		book.start(PLAYER_1_ID, MATCH_ID, 1, vi.fn());

		expect(book.forMatch(MATCH_ID)).toEqual({
			matchId: MATCH_ID,
			player: 0,
			deadline: '2026-11-06T12:00:30.000Z',
		});
	});

	it('keeps the other player waiting when one of the two comes back', () => {
		book.start(PLAYER_0_ID, MATCH_ID, 0, vi.fn());
		book.start(PLAYER_1_ID, MATCH_ID, 1, vi.fn());

		book.cancel(PLAYER_0_ID);

		expect(book.forMatch(MATCH_ID)).toMatchObject({ player: 1 });
	});

	it('disarms everything on shutdown', () => {
		const onExpiry = vi.fn();
		book.start(PLAYER_0_ID, MATCH_ID, 0, onExpiry);

		book.onModuleDestroy();

		vi.advanceTimersByTime(GRACE_MS * 2);
		expect(onExpiry).not.toHaveBeenCalled();
		expect(book.forMatch(MATCH_ID)).toBeNull();
	});
});
