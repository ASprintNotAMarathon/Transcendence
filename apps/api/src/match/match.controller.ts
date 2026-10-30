import { Controller, Get, HttpStatus, Res, UseGuards } from '@nestjs/common';
import type { LiveMatch } from '@transcendence/shared';
import type { Response } from 'express';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../auth';
import { MatchService } from './match.service';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchController {
	constructor(private readonly service: MatchService) {}

	@Get('live')
	live(): Promise<LiveMatch[]> {
		return this.service.live();
	}

	@Get('current')
	async current(
		@CurrentUser() user: AuthUser,
		@Res({ passthrough: true }) res: Response,
	): Promise<LiveMatch | undefined> {
		const match = await this.service.current(user.id);
		if (match === null) {
			res.status(HttpStatus.NO_CONTENT);
			return undefined;
		}
		return match;
	}
}
