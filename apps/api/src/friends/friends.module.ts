import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WsModule } from '../ws/ws.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

/**
 * Same shape as UsersModule: PrismaModule is global, and AuthModule is
 * imported for JwtAuthGuard.
 */
@Module({
	// WsModule for WsRegistry: who has a socket open right now.
	imports: [AuthModule, WsModule],
	controllers: [FriendsController],
	providers: [FriendsService],
	// UsersModule uses it for the friendship field on a profile.
	exports: [FriendsService],
})
export class FriendsModule {}
