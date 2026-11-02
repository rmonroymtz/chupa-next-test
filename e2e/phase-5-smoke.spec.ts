import { expect, test } from '@playwright/test';

/**
 * Phase 5 smoke (basic account pages served by Next). Read-only: a fresh
 * browser has no session, so it only checks what a guest sees (the pages answer
 * 200 and send the shopper to sign in from the browser) and never signs in or
 * writes anything. Runs only with `E2E_BASE_URL` and the opt-in
 * `E2E_PHASE5_SMOKE=1` (see `playwright.config.ts`), against a Next server or
 * an edge with the phase 5 routing in place.
 *
 *   E2E_BASE_URL=http://localhost:3000 E2E_PHASE5_SMOKE=1 \
 *     pnpm test:e2e --project phase-5-smoke
 *
 * Against an edge that still routes these urls to PWA Studio it fails on
 * `Vary: rsc`, which only Next sends, or on the alias redirects.
 */
const baseUrl = process.env.E2E_BASE_URL?.trim();

test.skip(!baseUrl, 'Set E2E_BASE_URL to run the phase 5 smoke against a real server');

const ACCOUNT_PAGES = [
  '/my-account',
  '/my-account/account-information',
  '/my-account/edit-account-information',
  '/my-account/address-book',
  '/my-account/address-book/new',
  '/my-account/address-book/edit/1',
  '/my-account/support',
] as const;

const ALIASES = [
  '/order-history',
  '/account-information',
  '/address-book',
  '/saved-payments',
  '/quotes',
] as const;

/** The robots meta tag of a raw html document (request API, no browser). */
const robotsOf = (html: string) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? null;

test.describe('phase 5 smoke', () => {
  for (const path of ACCOUNT_PAGES) {
    test(`${path}: 200 from Next, noindex, not cacheable`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      // `Vary: rsc` only comes from Next (the PWA pages do not send it).
      expect(response.headers()['vary'] ?? '').toContain('rsc');
      expect(response.headers()['cache-control'] ?? '').toContain('no-store');
      expect(robotsOf(await response.text())).toBe('noindex, nofollow');
    });
  }

  test('a guest is sent to sign in and the url to come back to is kept', async ({ page }) => {
    await page.goto('/my-account/address-book');
    await expect(page).toHaveURL(/\/sign-in\?from=%2Fmy-account%2Faddress-book$/);
  });

  for (const alias of ALIASES) {
    test(`the legacy alias ${alias} redirects under /my-account`, async ({ request }) => {
      const response = await request.get(`${alias}?callbackUrl=%2Fcheckout`, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const location = new URL(response.headers()['location'] ?? '', baseUrl);
      expect(location.pathname).toBe(`/my-account${alias}`);
      expect(location.search).toBe('?callbackUrl=%2Fcheckout');
    });
  }

  test('the reset password link without a token shows the legacy error, noindex and no Referer', async ({
    page,
  }) => {
    const response = await page.goto('/customer/account/createPassword');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['vary'] ?? '').toContain('rsc');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    await expect(
      page.getByText('Uh oh, algo salió mal. Verifica el enlace o inténtalo de nuevo.'),
    ).toBeVisible();
  });

  test('the reset password link with a token shows the form (nothing is sent)', async ({
    page,
  }) => {
    await page.goto('/customer/account/createPassword?token=0123456789abcdef0123456789abcdef');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Restablecer contraseña' }),
    ).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeVisible();
  });
});
