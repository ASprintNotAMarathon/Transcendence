import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * The end-to-end suite, in its own config exactly as the Jest setup kept it in
 * its own file.
 *
 * These boot the real AppModule, so `app.init()` opens a database connection.
 * Nothing runs them automatically: `npm test` covers src/ only, and CI runs
 * `make test`, which does the same. Run them by hand against a live database.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    globals: false,
    setupFiles: ['reflect-metadata'],
  },
  plugins: [
    // Same reason as vitest.config.ts: esbuild cannot emit decorator metadata.
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2023',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
