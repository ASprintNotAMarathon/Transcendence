import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * PrismaModule is @Global, so UsersService gets PrismaService by constructor
 * alone. AuthModule is imported for JwtAuthGuard, which the controller uses.
 */
@Module({
	imports: [AuthModule],
	controllers: [UsersController],
	providers: [UsersService],
})
export class UsersModule {}
