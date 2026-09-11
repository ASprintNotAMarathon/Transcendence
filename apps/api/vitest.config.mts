import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the api, on the same runner shared/ already uses.
 *
 * Jest arrived with `nest new` and was never a considered choice. It cannot
 * load @transcendence/shared at all: that package is ESM, and Jest's module
 * loader is CommonJS from before ESM existed. Vitest loads ESM natively, so the
 * shared package resolves through its ordinary package exports with no mapping
 * and no special case, and the repo stops running two runners for one codebase.
 *
 * Nothing here changes how the app is built or shipped. `nest build` still
 * emits CommonJS, and Node requires the shared package's ESM build without
 * complaint. This file only governs tests.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',

    // Matching shared/, where every test file imports describe/it/expect by
    // name. One convention across both workspaces is most of the point here.
    globals: false,

    // Nest recovers constructor types from decorator metadata, and that
    // metadata only exists at runtime once reflect-metadata has been loaded.
    setupFiles: ['reflect-metadata'],
  },
  plugins: [
    // Vite compiles TypeScript with esbuild, which has never implemented
    // emitDecoratorMetadata. Nest needs it: PrismaService takes a ConfigService
    // with no @Inject(), so the emitted metadata is the only surviving record
    // of that parameter's type. Without this plugin Nest cannot resolve the
    // dependency and every spec that builds a module fails. swc does implement
    // it, so swc does the transform instead of esbuild.
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
