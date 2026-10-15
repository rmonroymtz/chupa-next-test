import { expect, test, type APIResponse } from '@playwright/test';

/**
 * Phase 2 smoke (home and category pages served by Next). Read-only: it only
 * loads pages, so it creates no cart. Runs only with `E2E_BASE_URL` and the
 * opt-in `E2E_PHASE2_SMOKE=1` (see `playwright.config.ts`), against a Next
 * server or an edge with the phase 2 routing in place.
 *
 * Production categories have no products today, so the defaults are staging
 * examples; do not point it at production until they do.
 *
 *   E2E_BASE_URL=http://localhost:3000 E2E_PHASE2_SMOKE=1 \
 *     pnpm test:e2e --project phase-2-smoke
 *
 * Optional overrides:
 *   E2E_CATEGORY_PATH=/herramientas.html          category with products
 *   E2E_HOME_CMS_PATH=/venia-new-home             the configured home CMS page's own url
 *   E2E_UNKNOWN_HTML_PATH=/e2e-no-such-page.html  a .html url Magento does not know
 */
const baseUrl = process.env.E2E_BASE_URL?.trim();
const categoryPath = process.env.E2E_CATEGORY_PATH?.trim() || '/herramientas.html';
const homeCmsPath = process.env.E2E_HOME_CMS_PATH?.trim() || '/venia-new-home';
const unknownHtmlPath = process.env.E2E_UNKNOWN_HTML_PATH?.trim() || '/e2e-no-such-page.html';

test.skip(!baseUrl, 'Set E2E_BASE_URL to run the phase 2 smoke against a real server');

/** Path of an absolute canonical url (its origin is `PUBLIC_BASE_URL`, not the tested host). */
const pathOf = (href: string | null) => (href === null ? null : new URL(href).pathname);

/**
 * Location header as a path plus query. An absolute location must stay on the
 * tested origin (a redirect to another host would be a routing bug).
 */
const locationOf = (response: APIResponse) => {
  const location = response.headers()['location'];
  if (!location) return null;
  const testedOrigin = new URL(baseUrl ?? '').origin;
  const url = new URL(location, testedOrigin);
  expect(url.origin, `redirect leaves the tested origin: ${location}`).toBe(testedOrigin);
  return `${url.pathname}${url.search}`;
};

/** The category url with `?page` replaced, and the clean url the server must redirect to. */
const withInvalidPage = (path: string) => {
  const url = new URL(path, 'http://placeholder');
  url.searchParams.delete('page');
  const clean = `${url.pathname}${url.search}`;
  url.searchParams.set('page', 'abc');
  return { request: `${url.pathname}${url.search}`, clean };
};

test.describe('phase 2 smoke', () => {
  test('home: 200, canonical root, menu links to category pages (no /search.html)', async ({
    page,
  }) => {
    const response = await page.goto('/', { waitUntil: 'load' });
    expect(response?.status()).toBe(200);
    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute('href'))).toBe('/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');

    // Desktop and mobile menus stream in separate Suspense boundaries: prove
    // each one has rendered its category links before asserting on it.
    for (const label of ['Categorías', 'Menú principal']) {
      const nav = page.locator(`nav[aria-label="${label}"]`);
      await expect(nav.locator('a[href$=".html"]').first(), `${label} links`).toBeAttached();
      await expect(nav.locator('a[href*="search.html"]'), `${label} search links`).toHaveCount(0);
    }
  });

  test('category: 200, indexable, h1, product cards, canonical without page', async ({ page }) => {
    const response = await page.goto(categoryPath);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByTestId('product-price').first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute('href'))).toBe(
      new URL(categoryPath, 'http://placeholder').pathname,
    );
  });

  test('category with an invalid page: 307 to the clean url', async ({ request }) => {
    const { request: invalid, clean } = withInvalidPage(categoryPath);
    const response = await request.get(invalid, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(locationOf(response)).toBe(clean);
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
