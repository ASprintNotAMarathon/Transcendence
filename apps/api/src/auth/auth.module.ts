import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TOKEN_TTL_S } from './auth-cookie';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import type { EnvConfig } from '../config/env.validation';

@Module({
	imports: [
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<EnvConfig, true>) => ({
				secret: config.get('JWT_SECRET', { infer: true }),
				signOptions: { expiresIn: TOKEN_TTL_S },
			}),
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, JwtAuthGuard, PasswordService],
	exports: [
		// So any module can put @UseGuards(JwtAuthGuard) on a route.
		JwtAuthGuard,
		// Re-exported with it: the guard needs JwtService, and a module holding
		// the guard class but not the service it depends on cannot build it.
		JwtModule,
		// So the seed script hashes with the same helper. Two different argon2
		// configurations means every seeded login fails.
		PasswordService,
	],
})
export class AuthModule {}
