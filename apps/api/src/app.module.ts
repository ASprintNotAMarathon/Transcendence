import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';

// The repo keeps a single .env at its root. Without this, @nestjs/config looks
// for .env in the current working directory, so `npm start` would read a
// different file depending on where you launched it from. __dirname is the
// directory of this file, which is three levels below the root from both
// apps/api/src (dev) and apps/api/dist (built).
const ROOT_ENV = join(__dirname, '..', '..', '..', '.env');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ROOT_ENV,
      validate: validateEnv,
    }),
    PrismaModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
