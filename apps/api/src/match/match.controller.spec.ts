import { HttpStatus } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { LiveMatch } from '@transcendence/shared';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';

const USER = { id: 'player-0-uuid' };

const LIVE_MATCH: LiveMatch = {
	matchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
	game: 'gomoku',
	players: [
		{ userId: 'player-0-uuid', displayName: 'lisandro' },
		{ userId: 'player-1-uuid', displayName: 'kimia' },
	],
	turn: 0,
	moveNumber: 2,
	startedAt: '2026-10-17T10:00:00.000Z',
};

function fakeResponse() {
	const status = vi.fn();
	return { res: { status } as unknown as Response, status };
}

describe('MatchController', () => {
	let controller: MatchController;
	let live: ReturnType<typeof vi.fn>;
	let current: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		live = vi.fn();
		current = vi.fn();

		const moduleRef = await Test.createTestingModule({
			controllers: [MatchController],
			providers: [{ provide: MatchService, useValue: { live, current } }],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		controller = moduleRef.get(MatchController);
	});

	it('puts both routes behind JwtAuthGuard', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, MatchController)).toEqual([
			JwtAuthGuard,
		]);
	});

	it('answers live with the service list', async () => {
		live.mockResolvedValue([LIVE_MATCH]);

		expect(await controller.live()).toEqual([LIVE_MATCH]);
	});

	it('asks for the current match of the logged-in user', async () => {
		current.mockResolvedValue(LIVE_MATCH);
		const { res } = fakeResponse();

		await controller.current(USER, res);

		expect(current).toHaveBeenCalledWith(USER.id);
	});

	it('answers current with the match and leaves the status alone', async () => {
		current.mockResolvedValue(LIVE_MATCH);
		const { res, status } = fakeResponse();

		expect(await controller.current(USER, res)).toEqual(LIVE_MATCH);
		expect(status).not.toHaveBeenCalled();
	});

	it('answers current with 204 and no body when the user has no live match', async () => {
		current.mockResolvedValue(null);
		const { res, status } = fakeResponse();

		expect(await controller.current(USER, res)).toBeUndefined();
		expect(status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
	});
});
