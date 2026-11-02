import { expect, test } from '@playwright/test';

/**
 * Phase 4 smoke (cart page and customer screens served by Next). Read-only:
 * a fresh browser has no cart or session, so it creates nothing in Magento and
 * never signs in. Runs only with `E2E_BASE_URL` and the opt-in
 * `E2E_PHASE4_SMOKE=1` (see `playwright.config.ts`), against a Next server or
 * an edge with the phase 4 routing in place.
 *
 *   E2E_BASE_URL=http://localhost:3000 E2E_PHASE4_SMOKE=1 \
 *     pnpm test:e2e --project phase-4-smoke
 *
 * Against an edge that still routes these urls to PWA Studio it fails on
 * `Vary: rsc`, which only Next sends.
 */
const baseUrl = process.env.E2E_BASE_URL?.trim();

test.skip(!baseUrl, 'Set E2E_BASE_URL to run the phase 4 smoke against a real server');

const SCREENS = [
  { path: '/cart', heading: undefined },
  { path: '/sign-in', heading: 'Inicia sesión' },
  { path: '/create-account', heading: 'Crear cuenta' },
  { path: '/forgot-password', heading: 'Recuperar contraseña' },
] as const;

test.describe('phase 4 smoke', () => {
  for (const { path, heading } of SCREENS) {
    test(`${path}: 200, served by Next, noindex`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['vary'] ?? '').toContain('rsc');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      if (heading)
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    });
  }

  test('/cart: a fresh browser sees the empty state and the header count at zero', async ({
    page,
  }) => {
    await page.goto('/cart');
    await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continuar comprando →' })).toHaveAttribute(
      'href',
      '/',
    );
    await expect(page.getByRole('button', { name: /mini carrito/ })).toHaveAccessibleName(
      /Tienes 0 artículos/,
    );
  });

  test('/sign-in: the form fields and the secondary links are there', async ({ page }) => {
    await page.goto('/sign-in?from=/order-history');
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      /from=%2Forder-history/,
    );
  });

  test('/sign-in: an external `from` is not carried into the links', async ({ page }) => {
    await page.goto('/sign-in?from=https://evil.example/x');
    const hrefs = await page
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(hrefs.some((href) => href.includes('evil.example'))).toBe(false);
  });
});
