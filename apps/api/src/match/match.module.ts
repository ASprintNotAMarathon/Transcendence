import { Module } from '@nestjs/common';
import { MatchService } from './match.service';

/**
 * No imports array, because PrismaModule is @Global: MatchService gets
 * PrismaService by constructor alone.
 *
 * The service is exported because the gateway in step 5 will need it. Nothing
 * else should reach for it. The gateway is meant to be the only caller, thin
 * enough that all of the thinking stays in here.
 */
@Module({
	providers: [MatchService],
	exports: [MatchService],
})
export class MatchModule {}
