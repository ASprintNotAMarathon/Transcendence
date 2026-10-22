import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import type { EnvConfig } from './config/env.validation';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	configureApp(app);
	const config = app.get(ConfigService<EnvConfig, true>);
	await app.listen(config.get('API_PORT', { infer: true }));
}
void bootstrap();
