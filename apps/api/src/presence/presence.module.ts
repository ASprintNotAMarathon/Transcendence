import { Module } from '@nestjs/common';
import { WsModule } from '../ws/ws.module';
import { PresenceHandlers } from './presence.handlers';
import { PresenceService } from './presence.service';

/**
 * Presence for every player. PrismaModule is global; WsModule is imported
 * for the registry (who is online), the dispatcher and the sender.
 */
@Module({
	imports: [WsModule],
	providers: [PresenceService, PresenceHandlers],
	// UsersModule uses it for the online field on a profile.
	exports: [PresenceService],
})
export class PresenceModule {}
