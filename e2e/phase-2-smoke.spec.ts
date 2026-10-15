import { expect, test, type APIResponse } from '@playwright/test';

/**
 * Phase 2 smoke (home and category pages served by Next). Read-only: it only
 * loads pages, so it creates no cart. Runs when `E2E_BASE_URL` is set, against
 * a Next server or an edge with the phase 2 routing in place.
 *
 * Production categories have no products today, so the defaults are staging
 * examples; do not point it at production until they do.
 *
 *   E2E_BASE_URL=http://localhost:3000 pnpm test:e2e --project phase-2-smoke
 *
 * Optional overrides:
 *   E2E_CATEGORY_PATH=/herramientas.html       category with products
 *   E2E_HOME_CMS_PATH=/venia-new-home          the configured home CMS page's own url
 *   E2E_UNKNOWN_HTML_PATH=/e2e-no-such-page.html  a .html url Magento does not know
 */
const baseUrl = process.env.E2E_BASE_URL?.trim();
const categoryPath = process.env.E2E_CATEGORY_PATH?.trim() || '/herramientas.html';
const homeCmsPath = process.env.E2E_HOME_CMS_PATH?.trim() || '/venia-new-home';
const unknownHtmlPath = process.env.E2E_UNKNOWN_HTML_PATH?.trim() || '/e2e-no-such-page.html';

test.skip(!baseUrl, 'Set E2E_BASE_URL to run the phase 2 smoke against a real server');

/** Path of an absolute canonical url (its origin is `PUBLIC_BASE_URL`, not the tested host). */
const pathOf = (href: string | null) => (href === null ? null : new URL(href).pathname);

/** Location header as a path (`?query` kept), whether the server sends it absolute or relative. */
const locationOf = (response: APIResponse) => {
  const location = response.headers()['location'];
  if (!location) return null;
  const url = new URL(location, 'http://placeholder');
  return `${url.pathname}${url.search}`;
};

test.describe('phase 2 smoke', () => {
  test('home: 200, canonical root, menu links to category pages (no /search.html)', async ({
    page,
  }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute('href'))).toBe('/');

    const menu = page.locator('nav[aria-label="Categorías"], nav[aria-label="Menú principal"]');
    await expect(menu.locator('a[href$=".html"]').first()).toBeAttached();
    await expect(menu.locator('a[href*="search.html"]')).toHaveCount(0);
  });

  test('category: 200, h1, product cards, canonical without page', async ({ page }) => {
    const response = await page.goto(categoryPath);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByTestId('product-price').first()).toBeVisible();
    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute('href'))).toBe(
      categoryPath,
    );
  });

  test('category with an invalid page: 307 to the clean url', async ({ request }) => {
    const response = await request.get(`${categoryPath}?page=abc`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(locationOf(response)).toBe(categoryPath);
  });

  test('unknown .html url: 404', async ({ request }) => {
    const response = await request.get(unknownHtmlPath, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });

  test("the home CMS page's own url: 308 to /", async ({ request }) => {
    const response = await request.get(homeCmsPath, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(locationOf(response)).toBe('/');
  });
});
