import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suites (`pnpm test:e2e`):
 * - `local`: the standalone server against mock Magento/CHAPI (started by
 *   `e2e/support/local-stack.ts`), checking the cart shared with PWA Studio.
 * - `pwa-checkout`: Next PDP → add to cart → PWA Studio `/checkout` on a real
 *   environment. Runs only when `E2E_BASE_URL` is set (it creates a real cart);
 *   the local stack is then not started.
 */
const remoteBaseUrl = process.env.E2E_BASE_URL?.trim() || undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  outputDir: './test-results/e2e',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  ...(remoteBaseUrl ? {} : { globalSetup: './e2e/support/local-stack.ts' }),
  projects: remoteBaseUrl
    ? [{ name: 'pwa-checkout', testMatch: 'pwa-checkout.spec.ts', use: { baseURL: remoteBaseUrl } }]
    : [
        { name: 'local', testMatch: 'local/**/*.spec.ts' },
        { name: 'pwa-checkout', testMatch: 'pwa-checkout.spec.ts' },
      ],
});
