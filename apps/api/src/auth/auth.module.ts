import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TOKEN_TTL_S } from './auth-cookie';
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
	providers: [PasswordService],
	// Exported so the seed script hashes with the same helper. Two different
	// argon2 configurations means every seeded login fails.
	exports: [PasswordService],
})
export class AuthModule {}
