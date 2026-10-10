import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests: run the real Next.js server (`next build` + standalone `server.js`)
 * against mock Magento and CHAPI HTTP servers. Slow by design; kept out of
 * `pnpm test`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/support/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 240_000,
  },
});
