/**
 * Validates process.env at boot, so a missing or malformed variable
 * stops the app immediately with a clear message instead of failing
 * later on the one route that needed it.
 *
 * Passed to ConfigModule.forRoot({ validate }) in app.module.ts.
 */

export interface EnvConfig {
  API_PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  WS_DEV_AUTH: boolean;
}

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
        'The repo has a single env file at its root: copy .env.example to .env and fill in the values.',
    );
  }

  const port = config.API_PORT === undefined ? 3000 : Number(config.API_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `API_PORT must be an integer between 1 and 65535, got "${String(config.API_PORT)}"`,
    );
  }

  const secret = String(config.JWT_SECRET);
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters, got ${secret.length}. Generate one with: openssl rand -hex 32`,
    );
  }

  /* Dev-only stand-in for the cookie check, until verify function lands. Absent means off:
  a machine that has not opted in gets no fake identity, and with it off nothing can connect at all.
  This is deliberate.
  */
  const devAuth = config.WS_DEV_AUTH === undefined ? 'false' : String(config.WS_DEV_AUTH);
  if (devAuth !== 'true' && devAuth !== 'false') {
    throw new Error(
      `WS_DEV_AUTH must be "true" or "false", got "${devAuth}"`, 
    );
  }

  return {
    API_PORT: port,
    DATABASE_URL: String(config.DATABASE_URL),
    JWT_SECRET: secret,
    WS_DEV_AUTH: devAuth === 'true',
  };
}
