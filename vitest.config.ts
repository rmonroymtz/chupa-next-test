import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/support/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Unit tests only; the slow server-level suite runs with `pnpm test:integration`.
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
