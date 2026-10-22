import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WsModule } from '../ws/ws.module';
import { MatchController } from './match.controller';
import { MatchHandlers } from './match.handlers';
import { MatchService } from './match.service';

/**
 * PrismaModule is @Global, so MatchService gets PrismaService by constructor alone.
 * WsModule is imported for the dispatcher and sender the handlers register with and send through,
 * and AuthModule for the guard on the controller's routes.
 *
 * Nothing is exported. MatchHandlers (the socket side) and MatchController (the HTTP side)
 * are meant to be the service's only callers, thin enough that all of the thinking stays in MatchService.
 */
@Module({
	imports: [AuthModule, WsModule],
	controllers: [MatchController],
	providers: [MatchService, MatchHandlers],
})
export class MatchModule {}
