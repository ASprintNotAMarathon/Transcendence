// Prisma 7 does not read .env on its own, and this repo keeps a single .env at
// its root rather than one per workspace. So the path is spelled out: this file
// sits in apps/api, the .env two directories above it.
import { config } from 'dotenv';
import { join } from 'node:path';
import { defineConfig } from 'prisma/config';

config({ path: join(__dirname, '..', '..', '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
