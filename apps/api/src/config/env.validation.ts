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
}

const REQUIRED = ['DATABASE_URL'] as const;

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

  return {
    API_PORT: port,
    DATABASE_URL: String(config.DATABASE_URL),
  };
}
