import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { FriendsModule } from '../friends/friends.module';
import { PresenceModule } from '../presence/presence.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * PrismaModule is @Global, so UsersService gets PrismaService by constructor
 * alone. AuthModule is imported for JwtAuthGuard, which the controller uses,
 * FriendsModule for the friendship field on a profile, and PresenceModule
 * for the online field.
 */
@Module({
	imports: [AuthModule, FriendsModule, PresenceModule],
	controllers: [UsersController],
	providers: [UsersService],
})
export class UsersModule {}
