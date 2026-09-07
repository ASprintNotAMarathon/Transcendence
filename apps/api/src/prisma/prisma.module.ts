import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global, so a feature module injects PrismaService by constructor alone
 * without importing anything. There is exactly one database, and making every
 * module restate that in its imports array buys nothing.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
