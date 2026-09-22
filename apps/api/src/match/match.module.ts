import { Module } from '@nestjs/common';
import { WsModule } from '../ws/ws.module';
import { MatchHandlers } from './match.handlers';
import { MatchService } from './match.service';

/**
 * PrismaModule is @Global, so MatchService gets PrismaService by constructor
 * alone. WsModule is imported for the dispatcher and sender the handlers
 * register with and send through.
 *
 * Nothing is exported. MatchHandlers is meant to be the service's only
 * caller, thin enough that all of the thinking stays in MatchService.
 */
@Module({
	imports: [WsModule],
	providers: [MatchService, MatchHandlers],
})
export class MatchModule {}
