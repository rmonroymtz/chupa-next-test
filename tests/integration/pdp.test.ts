import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import chapiFound from '../fixtures/chapi/product.ebay.found.json';
import productRoute from '../fixtures/magento/product-by-route.simple.json';
import storeConfig from '../fixtures/magento/store-config.json';
import { startMockBackends, type MockBackends, type RecordedCall } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PUBLIC_BASE_URL = 'https://chupaprecios.com.mx';

const EXISTING = productRoute.data.route.relative_url; // literal `|`
const OUT_OF_STOCK = 'amazon-B0OUTSTOCK-wireless-mouse.html';
const MISSING = 'ebay-126981644035-gildan-heavy-cotton-t-shirt.html';
const MISSING_SKU = '126981644035|428130345038';
const SLOW = 'ebay-500000000001-slow-product.html';
const UNKNOWN = 'ebay-500000000002-gone-product.html';
const OUTAGE = 'amazon-B0OUTAGE01-any-product.html';

const CHAPI_TIMEOUT_MS = 1_000;
const CHAPI_DELAY_MS = 600;

let backends: MockBackends;
let next: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {
      [EXISTING]: productRoute.data.route,
      [OUT_OF_STOCK]: {
        ...productRoute.data.route,
        relative_url: OUT_OF_STOCK,
        url_key: OUT_OF_STOCK.replace('.html', ''),
        sku: 'B0OUTSTOCK',
        name: 'Wireless Mouse',
        stock_status: 'OUT_OF_STOCK',
        related_products: [
          {
            uid: 'rel-1',
            sku: 'B0ALTERNAT',
            name: 'Alternative Mouse',
            url_key: 'amazon-B0ALTERNAT-alternative-mouse',
            url_suffix: '.html',
            small_image: { url: 'https://chupaprecios.com.mx/media/alt.jpg', label: null },
            price_range: { minimum_price: { final_price: { value: 250, currency: 'MXN' } } },
          },
        ],
      },
      'old-product.html': { type: 'PRODUCT', redirect_code: 301, relative_url: EXISTING },
      'about-us': {
        type: 'CMS_PAGE',
        redirect_code: 0,
        relative_url: 'about-us',
        identifier: 'about-us',
      },
      [OUTAGE]: 'outage',
    },
    storeConfig: storeConfig.data.storeConfig,
    chapi: {
      [`ebay:${MISSING_SKU}`]: { body: chapiFound },
      'ebay:500000000001': { body: chapiFound, delayMs: CHAPI_TIMEOUT_MS * 3 },
    },
    chapiDefaultDelayMs: CHAPI_DELAY_MS,
  });
  next = await startNext({
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL,
    CHAPI_TIMEOUT_MS: String(CHAPI_TIMEOUT_MS),
    MAGENTO_TIMEOUT_MS: '3000',
    COPY_MUTATION_TIMEOUT_MS: '3000',
    LOG_LEVEL: 'warn',
  });
});

afterAll(async () => {
  await next?.stop();
  await backends?.close();
});

beforeEach(() => backends.reset());

interface PageResponse {
  readonly status: number;
  readonly html: string;
  readonly headers: Headers;
  /** Body chunks with their arrival time (epoch ms). */
  readonly chunks: readonly { readonly at: number; readonly text: string }[];
  /** Epoch ms when the body finished. */
  readonly completedAt: number;
}

async function get(path: string, userAgent: string): Promise<PageResponse> {
  const response = await fetch(`${next.baseUrl}${path}`, {
    headers: { 'User-Agent': userAgent },
    redirect: 'manual',
  });
  const chunks: { at: number; text: string }[] = [];
  const decoder = new TextDecoder();
  if (response.body) {
    for await (const chunk of response.body) {
      chunks.push({ at: Date.now(), text: decoder.decode(chunk as Uint8Array, { stream: true }) });
    }
  }
  return {
    status: response.status,
    headers: response.headers,
    html: chunks.map((c) => c.text).join(''),
    chunks,
    completedAt: Date.now(),
  };
}

function robots(html: string): string | null {
  return /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? null;
}

function canonical(html: string): string | null {
  return /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null;
}

/** Polls the recorded calls briefly: the mutation runs after the response. */
async function waitForCalls(
  predicate: () => RecordedCall[],
  count: number,
  timeoutMs = 3_000,
): Promise<RecordedCall[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const calls = predicate();
    if (calls.length >= count) return calls;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return predicate();
}

const mutations = () => backends.callsTo('magento', 'generateMagentoSku');
const chapiCalls = () => backends.callsTo('chapi');
/** Waits long enough for a mutation that should NOT happen to show up. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 700));

describe('PDP — product exists in Magento', () => {
  it('exists + user: 200, indexable, canonical with literal |, mutation after the response', async () => {
    const page = await get(`/${EXISTING}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('index, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${EXISTING}`);
    expect(page.html).toContain(productRoute.data.route.name);
    expect(page.html).toContain('$1,145.13');

    const [mutation] = await waitForCalls(mutations, 1);
    expect(mutation?.body.variables).toEqual({ sku: '126981644035|428130345038', vendor: 'ebay' });
    expect(mutation!.receivedAt).toBeGreaterThanOrEqual(page.completedAt - 50);
    expect(chapiCalls()).toEqual([]);
  });

  it('exists + bot: 200, same indexability and canonical, no scraper and no mutation', async () => {
    const page = await get(`/${EXISTING}`, BOT_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('index, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${EXISTING}`);
    expect(page.html).toContain(productRoute.data.route.name);
    await settle();
    expect(mutations()).toEqual([]);
    expect(chapiCalls()).toEqual([]);
  });

  it('resolves %7C like a literal | and keeps the literal | in the canonical', async () => {
    const page = await get(`/${EXISTING.replace('|', '%7C')}`, BOT_UA);

    expect(page.status).toBe(200);
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${EXISTING}`);
    expect(backends.callsTo('magento', 'ProductByRoute')[0]?.body.variables).toEqual({
      url: EXISTING,
    });
  });

  it('out of stock: still 200 and indexable, shows availability and alternatives', async () => {
    const page = await get(`/${OUT_OF_STOCK}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('index, follow');
    expect(page.html).toContain('data-availability="out_of_stock"');
    expect(page.html).toContain('Alternativas disponibles');
    expect(page.html).toContain('href="/amazon-B0ALTERNAT-alternative-mouse.html"');
  });

  it('runs a single Magento route lookup per request (metadata and page share it)', async () => {
    await get(`/${EXISTING}`, BOT_UA);

    expect(backends.callsTo('magento', 'ProductByRoute')).toHaveLength(1);
  });
});

describe('PDP — product missing from Magento', () => {
  it('missing + bot: 404, no scraper and no mutation', async () => {
    const page = await get(`/${MISSING}`, BOT_UA);

    expect(page.status).toBe(404);
    expect(robots(page.html)).toContain('noindex');
    await settle();
    expect(chapiCalls()).toEqual([]);
    expect(mutations()).toEqual([]);
  });

  it('missing + user: streams a noindex shell, then the scraped product, then fires the mutation', async () => {
    const page = await get(`/${MISSING}?var=428130345038`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${MISSING}`);

    // Skeleton first, then the product in the same body.
    const skeletonAt = page.html.indexOf('data-testid="pdp-skeleton"');
    const productAt = page.html.indexOf(chapiFound.data.title);
    expect(skeletonAt).toBeGreaterThan(-1);
    expect(productAt).toBeGreaterThan(skeletonAt);
    expect(page.html).toContain('$1,145.13');

    // The shell (with the skeleton) arrived before the scraper answered.
    const [chapi] = chapiCalls();
    expect(chapi?.body).toEqual({ sku: MISSING_SKU, store: 'ebay', engine_id: 'api' });
    const shellChunk = page.chunks.find((c) => c.text.includes('data-testid="pdp-skeleton"'));
    expect(shellChunk!.at).toBeLessThan(chapi!.respondedAt!);
    expect(shellChunk!.text).not.toContain(chapiFound.data.title);

    // The mutation runs after the scraper call and after the response completed.
    const [mutation] = await waitForCalls(mutations, 1);
    expect(mutation?.body.variables).toEqual({ sku: MISSING_SKU, vendor: 'ebay' });
    expect(mutation!.receivedAt).toBeGreaterThanOrEqual(chapi!.respondedAt!);
    expect(mutation!.receivedAt).toBeGreaterThanOrEqual(page.completedAt - 50);
  });

  it('scraper timeout: 200 noindex with the unavailable state and no mutation', async () => {
    const page = await get(`/${SLOW}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(page.html).toContain('Producto no disponible');
    expect(page.html).toContain('/search.html?query=slow+product&amp;store=ebay');
    expect(chapiCalls()).toHaveLength(1);
    await settle();
    expect(mutations()).toEqual([]);
  });

  it('scraper not found: 200 noindex with the unavailable state and no mutation', async () => {
    const page = await get(`/${UNKNOWN}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(page.html).toContain('Producto no disponible');
    await settle();
    expect(mutations()).toEqual([]);
  });
});

describe('catch-all — other outcomes', () => {
  it('Magento outage: 5xx, never a 404, no scraper call', async () => {
    const page = await get(`/${OUTAGE}`, BROWSER_UA);

    expect(page.status).toBeGreaterThanOrEqual(500);
    expect(chapiCalls()).toEqual([]);
  });

  it('Magento 301 redirect: permanent HTTP redirect to the target', async () => {
    const page = await get('/old-product.html', BROWSER_UA);

    expect(page.status).toBe(308);
    expect(page.headers.get('location')).toBe(`/${EXISTING}`);
  });

  it('non-product url unknown to Magento: 404 for users too', async () => {
    const page = await get('/some/unknown/page', BROWSER_UA);

    expect(page.status).toBe(404);
    expect(chapiCalls()).toEqual([]);
  });

  it('CMS page: dispatched to the CMS renderer', async () => {
    const page = await get('/about-us', BROWSER_UA);

    expect(page.status).toBe(200);
    expect(page.html).toContain('data-testid="cms-placeholder"');
  });
});
