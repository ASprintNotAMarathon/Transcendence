import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

/**
 * Same shape as UsersModule: PrismaModule is global, and AuthModule is
 * imported for JwtAuthGuard.
 */
@Module({
	imports: [AuthModule],
	controllers: [FriendsController],
	providers: [FriendsService],
})
export class FriendsModule {}
