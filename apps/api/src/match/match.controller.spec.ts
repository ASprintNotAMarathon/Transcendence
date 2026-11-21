import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { LiveMatch } from '@transcendence/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';

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

describe('MatchController', () => {
	let controller: MatchController;
	let live: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		live = vi.fn();

		const moduleRef = await Test.createTestingModule({
			controllers: [MatchController],
			providers: [{ provide: MatchService, useValue: { live } }],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		controller = moduleRef.get(MatchController);
	});

	it('puts the routes behind JwtAuthGuard', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, MatchController)).toEqual([
			JwtAuthGuard,
		]);
	});

	it('answers live with the service list', async () => {
		live.mockResolvedValue([LIVE_MATCH]);

		expect(await controller.live()).toEqual([LIVE_MATCH]);
	});
});
