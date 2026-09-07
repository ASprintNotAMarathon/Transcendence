import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { EnvConfig } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';

/**
 * The one database connection the whole API shares.
 *
 * It extends PrismaClient rather than wrapping it, so every model is reached
 * the way the Prisma docs describe — `prisma.user.findMany()` — with no
 * per-model repository to keep in sync with the schema.
 *
 * Prisma 7 talks to Postgres through a driver adapter, and the adapter is
 * given the connection string explicitly. The schema's datasource block
 * therefore carries no url: the CLI reads it from prisma.config.ts, and the
 * running app reads it from ConfigService, which has already validated it.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<EnvConfig, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  /**
   * Connect during startup instead of on the first query. A bad DATABASE_URL
   * then fails the boot with one clear error, rather than surfacing as a
   * confusing 500 on whichever endpoint happens to be hit first.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  /**
   * Nest calls this on shutdown. Without it the pool keeps its sockets open,
   * which leaves tests hanging and containers slow to stop.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
