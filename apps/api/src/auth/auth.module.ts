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
		// So the socket handshake can call verifyToken. One verifier, one
		// secret, one set of verification options.
		AuthService,
		// So any module can put @UseGuards(JwtAuthGuard) on a route.
		JwtAuthGuard,
	],
})
export class AuthModule {}
