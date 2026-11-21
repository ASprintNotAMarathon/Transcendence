import { Controller, Get, UseGuards } from '@nestjs/common';
import type { LiveMatch } from '@transcendence/shared';
import { JwtAuthGuard } from '../auth';
import { MatchService } from './match.service';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchController {
	constructor(private readonly service: MatchService) {}

	@Get('live')
	live(): Promise<LiveMatch[]> {
		return this.service.live();
	}
}
