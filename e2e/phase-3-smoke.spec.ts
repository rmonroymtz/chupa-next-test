import { expect, test, type APIResponse } from '@playwright/test';

/**
 * Phase 3 smoke (search pages served by Next). Read-only: it only loads
 * pages, so it creates no cart, but every shopper search calls CHAPI. Runs
 * only with `E2E_BASE_URL` and the opt-in `E2E_PHASE3_SMOKE=1` (see
 * `playwright.config.ts`), against a Next server or an edge with the phase 3
 * routing in place.
 *
 *   E2E_BASE_URL=http://localhost:3000 E2E_PHASE3_SMOKE=1 \
 *     pnpm test:e2e --project phase-3-smoke
 *
 * Optional overrides:
 *   E2E_SEARCH_QUERY=taladro                           a query with results on amazon
 *   E2E_SKU_SEARCH_PATH=/amazon-B00IJ0ALYS-search.html a sku search url CHAPI knows
 */
const baseUrl = process.env.E2E_BASE_URL?.trim();
const query = process.env.E2E_SEARCH_QUERY?.trim() || 'taladro';
const skuSearchPath = process.env.E2E_SKU_SEARCH_PATH?.trim() || '/amazon-B00IJ0ALYS-search.html';

test.skip(!baseUrl, 'Set E2E_BASE_URL to run the phase 3 smoke against a real server');

/** Matches the bot list (`BOT_USER_AGENTS` default includes googlebot). */
const BOT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/** ChupaChoice lists, in the legacy order (`CHUPACHOICE_LISTS`). */
const CHUPACHOICE_STORES = ['amazon', 'ebay', 'target', 'acme'];

const searchPath = (params: Record<string, string>) =>
  `/search.html?${new URLSearchParams(params).toString()}`;

/** Path of an absolute canonical url (its origin is `PUBLIC_BASE_URL`, not the tested host). */
const pathOf = (href: string | null) => (href === null ? null : new URL(href).pathname);

/**
 * Location header as a url on the tested origin (a redirect to another host
 * would be a routing bug).
 */
const locationOf = (response: APIResponse) => {
  const location = response.headers()['location'];
  if (!location) return null;
  const testedOrigin = new URL(baseUrl ?? '').origin;
  const url = new URL(location, testedOrigin);
  expect(url.origin, `redirect leaves the tested origin: ${location}`).toBe(testedOrigin);
  return url;
};

/** The robots meta tag of a raw html document (request API, no browser). */
const robotsOf = (html: string) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? null;

test.describe('phase 3 smoke', () => {
  test('single store: 200, served by Next, noindex, product grid', async ({ page }) => {
    const response = await page.goto(searchPath({ query, store: 'amazon' }));
    expect(response?.status()).toBe(200);
    // `Vary: rsc` only comes from Next (the PWA search page does not send it).
    expect(response?.headers()['vary'] ?? '').toContain('rsc');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('h1')).toContainText(query);
    await expect(page.locator('[data-search-state="error"]')).toHaveCount(0);
    await expect(page.locator('[data-search-count]')).toBeVisible();
    await expect(page.getByTestId('product-price').first()).toBeVisible();
  });

  test('no store: the ChupaChoice view with one section per CHAPI store', async ({ page }) => {
    const response = await page.goto(searchPath({ query }));
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await expect(page.locator('[data-search-store="chupachoice"] h1')).toContainText(query);
    const sections = page.locator('section[data-search-section]');
    await expect(sections).toHaveCount(CHUPACHOICE_STORES.length);
    expect(
      await sections.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-search-section')),
      ),
    ).toEqual(CHUPACHOICE_STORES);
  });

  test('a store that is not a CHAPI store: 307 to the same search on chupachoice', async ({
    request,
  }) => {
    const response = await request.get(searchPath({ query, store: 'walmart' }), {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    const location = locationOf(response);
    expect(location?.pathname).toBe('/search.html');
    expect(location?.searchParams.get('store')).toBe('chupachoice');
    expect(location?.searchParams.get('query')).toBe(query);
  });

  test('blank query: 200, noindex, prompt instead of results', async ({ page }) => {
    const response = await page.goto('/search.html');
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await expect(page.getByText('Escribe lo que quieres buscar.')).toBeVisible();
    await expect(page.getByTestId('product-price')).toHaveCount(0);
  });

  test('sku search url: the CHAPI product on the same url, noindex, canonical to the product', async ({
    page,
  }) => {
    const response = await page.goto(skuSearchPath);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await expect(page.getByTestId('product-price').first()).toBeVisible();
    // Canonical: the product url built from the CHAPI answer, or the sku search url itself when
    // CHAPI has no usable title. Both start with the `/{vendor}-{sku}-` prefix of the request.
    const prefix = skuSearchPath.replace(/search\.html$/, '');
    const canonical = pathOf(await page.locator('link[rel="canonical"]').getAttribute('href'));
    expect(
      canonical?.toLowerCase().startsWith(prefix.toLowerCase()),
      `canonical ${canonical}`,
    ).toBe(true);
  });

  test('bots: search page without results, sku search url 404', async ({ request }) => {
    const headers = { 'user-agent': BOT_USER_AGENT };

    const search = await request.get(searchPath({ query, store: 'amazon' }), {
      headers,
      maxRedirects: 0,
    });
    expect(search.status()).toBe(200);
    const html = await search.text();
    expect(robotsOf(html)).toBe('noindex, follow');
    expect(html).toContain(query);
    expect(html).not.toContain('data-testid="product-price"');

    const sku = await request.get(skuSearchPath, { headers, maxRedirects: 0 });
    expect(sku.status()).toBe(404);
    expect(robotsOf(await sku.text())).toContain('noindex');
  });
});
