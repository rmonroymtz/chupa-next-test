import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import chapiAmazon from '../fixtures/chapi/product.amazon.synthetic.json';
import chapiFound from '../fixtures/chapi/product.ebay.found.json';
import productRoute from '../fixtures/magento/product-by-route.simple.json';
import storeConfig from '../fixtures/magento/store-config.json';
import { formatPrice } from '@/modules/product/ui/format-price';
import { startMockBackends, type MockBackends, type RecordedCall } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';
import { startRecordingProxy, type RecordingProxy } from './support/recording-proxy';

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
const DISCOUNTED = 'amazon-B0DISCOUNT-desk-lamp.html';
const HOSTILE_NAME = 'Lamp </script><script>window.pwned=1</script>';
const SKU_SEARCH = 'amazon-B00IJ0ALYS-search.html';
const SKU_SEARCH_PRODUCT_URL =
  'amazon-B00IJ0ALYS-dewalt-kit-de-combo-de-perforaci-n-inal-mbrico-de-20v-max-dck240c2-.html';
const SKU_SEARCH_MISS = 'amazon-B0NOTFOUND-search.html';
const SKU_SEARCH_FAILURE = 'amazon-B0FAILURE1-search.html';
/** Staging Magento answers this placeholder product for every vendor url it does not have. */
const placeholderFor = (url: string) => ({
  ...productRoute.data.route,
  relative_url: url,
  url_key: 'carmina-earrings',
  url_suffix: '.html',
  sku: 'VA11-GO-NA',
  name: 'Carmina Earrings',
});

const SKU_SEARCH_SLOW = 'amazon-B0SLOWSKU1-search.html';
const SKU_SEARCH_HYPHEN = 'amazon-ABC-123-search.html';
/** Production Magento answers this placeholder for vendor urls it does not have. */
const productionPlaceholderFor = (url: string) => ({
  ...placeholderFor(url),
  url_key: null,
  sku: 'urllocator-external-placeholder',
  name: 'External URL Placeholder',
});

/** Real Magento product whose own sku is not in its url (url key + suffix is the url). */
const OWN_URL_KEY = 'amazon-B0OWNKEY01-Own-Key-Lamp';
const OWN_URL = `${OWN_URL_KEY.toLowerCase()}.html`;

const CHAPI_TIMEOUT_MS = 1_000;
const CHAPI_DELAY_MS = 600;

let backends: MockBackends;
let next: RunningNext;
let proxy: RecordingProxy;

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
      [DISCOUNTED]: {
        ...productRoute.data.route,
        relative_url: DISCOUNTED,
        url_key: DISCOUNTED.replace('.html', ''),
        sku: 'B0DISCOUNT',
        name: HOSTILE_NAME,
        brand: 'Lumos',
        categories: [
          {
            name: 'Iluminación',
            url_path: 'hogar/iluminacion',
            breadcrumbs: [
              { category_uid: 'MQ==', category_name: 'Hogar', category_url_path: 'hogar' },
            ],
          },
        ],
        price_range: {
          minimum_price: {
            final_price: { value: 899.5, currency: 'MXN' },
            regular_price: { value: 1299, currency: 'MXN' },
            discount: { amount_off: 399.5, percent_off: 30.75 },
          },
        },
      },
      'old-product.html': { type: 'PRODUCT', redirect_code: 301, relative_url: EXISTING },
      [SKU_SEARCH]: placeholderFor(SKU_SEARCH),
      [SKU_SEARCH_MISS]: placeholderFor(SKU_SEARCH_MISS),
      [SKU_SEARCH_FAILURE]: placeholderFor(SKU_SEARCH_FAILURE),
      [SKU_SEARCH_SLOW]: placeholderFor(SKU_SEARCH_SLOW),
      [SKU_SEARCH_HYPHEN]: productionPlaceholderFor(SKU_SEARCH_HYPHEN),
      [SKU_SEARCH_PRODUCT_URL]: productionPlaceholderFor(SKU_SEARCH_PRODUCT_URL),
      [OWN_URL]: {
        ...productRoute.data.route,
        relative_url: OWN_URL,
        url_key: OWN_URL_KEY,
        url_suffix: '.html',
        sku: 'MAGENTO-OWN-SKU',
        name: 'Own Key Lamp',
      },
      [OUTAGE]: 'outage',
    },
    storeConfig: storeConfig.data.storeConfig,
    chapi: {
      [`ebay:${MISSING_SKU}`]: { body: chapiFound },
      'ebay:500000000001': { body: chapiFound, delayMs: CHAPI_TIMEOUT_MS * 3 },
      'amazon:B00IJ0ALYS': { body: chapiAmazon },
      'amazon:B0FAILURE1': { status: 500, body: { detail: 'boom' } },
      'amazon:B0SLOWSKU1': { body: chapiAmazon, delayMs: CHAPI_TIMEOUT_MS * 3 },
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
  proxy = await startRecordingProxy(next.baseUrl, backends.nextSeq);
});

afterAll(async () => {
  await proxy?.close();
  await next?.stop();
  await backends?.close();
});

beforeEach(() => backends.reset());

interface PageResponse {
  readonly status: number;
  readonly html: string;
  readonly headers: Headers;
  /** Body chunks with their position in the mocks' shared event order. */
  readonly chunks: readonly { readonly seq: number; readonly text: string }[];
  /** Event order position of the last bytes Next wrote for this response (server side). */
  readonly serverDoneSeq: number;
}

async function get(path: string, userAgent: string): Promise<PageResponse> {
  // Through the recording proxy, which observes when Next finished writing.
  const response = await fetch(`${proxy.baseUrl}${path}`, {
    headers: { 'User-Agent': userAgent },
    redirect: 'manual',
  });
  const chunks: { seq: number; text: string }[] = [];
  const decoder = new TextDecoder();
  if (response.body) {
    for await (const chunk of response.body) {
      chunks.push({
        seq: backends.nextSeq(),
        text: decoder.decode(chunk as Uint8Array, { stream: true }),
      });
    }
  }
  return {
    status: response.status,
    headers: response.headers,
    html: chunks.map((c) => c.text).join(''),
    chunks,
    serverDoneSeq: proxy.lastUpstreamSeq(),
  };
}

function robots(html: string): string | null {
  return /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? null;
}

function canonical(html: string): string | null {
  return /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null;
}

type JsonLdNode = Record<string, unknown> & { '@type'?: string };

/** Every JSON-LD block in the page, parsed. */
function jsonLd(html: string): JsonLdNode[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1]!) as JsonLdNode,
  );
}

const ofType = (html: string, type: string) => jsonLd(html).filter((n) => n['@type'] === type);

/** Current (first) amount inside the visible price block. */
function visiblePrice(html: string): string | null {
  const block = /data-testid="product-price"[\s\S]*?<\/p>/.exec(html)?.[0] ?? '';
  return /\$[\d,]+\.\d{2}/.exec(block)?.[0] ?? null;
}

function meta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`<meta (?:property|name)="${escaped}" content="([^"]*)"`).exec(html)?.[1] ?? null
  );
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
    // `after()` only starts the mutation once Next finished writing the response.
    expect(mutation!.receivedSeq).toBeGreaterThan(page.serverDoneSeq);
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

  it('declares Product JSON-LD whose offer price equals the visible price, plus breadcrumbs and social cards', async () => {
    const page = await get(`/${EXISTING}`, BOT_UA);
    const [product] = ofType(page.html, 'Product');
    const offers = product?.offers as Record<string, unknown>;

    expect(ofType(page.html, 'Product')).toHaveLength(1);
    expect(product).toMatchObject({
      name: productRoute.data.route.name,
      sku: productRoute.data.route.sku,
      url: `${PUBLIC_BASE_URL}/${EXISTING}`,
    });
    expect(offers).toMatchObject({
      '@type': 'Offer',
      price: 1145.13,
      priceCurrency: 'MXN',
      availability: 'https://schema.org/InStock',
    });
    expect(visiblePrice(page.html)).toBe(formatPrice(offers.price as number, 'MXN'));
    expect(ofType(page.html, 'BreadcrumbList')).toHaveLength(1);
    expect(meta(page.html, 'og:url')).toBe(`${PUBLIC_BASE_URL}/${EXISTING}`);
    expect(meta(page.html, 'og:locale')).toBe('es_MX');
    expect(meta(page.html, 'twitter:card')).toBe('summary_large_image');
    expect(page.html).toContain(`<title>${productRoute.data.route.name} | Chupaprecios</title>`);
  });

  it('discounted product: JSON-LD price is the final price shown, never the regular one', async () => {
    const page = await get(`/${DISCOUNTED}`, BOT_UA);
    const [product] = ofType(page.html, 'Product');
    const offers = product?.offers as Record<string, unknown>;

    expect(page.status).toBe(200);
    expect(offers.price).toBe(899.5);
    expect(visiblePrice(page.html)).toBe(formatPrice(899.5, 'MXN'));
    expect(page.html).toContain(formatPrice(1299, 'MXN')); // struck-through regular price
    expect(product?.brand).toEqual({ '@type': 'Brand', name: 'Lumos' });
    const [breadcrumbs] = ofType(page.html, 'BreadcrumbList');
    expect((breadcrumbs?.itemListElement as { name: string }[]).map((item) => item.name)).toEqual([
      'Inicio',
      'Hogar',
      'Iluminación',
      HOSTILE_NAME,
    ]);
  });

  it('escapes structured data so a product name cannot break out of the script element', async () => {
    const page = await get(`/${DISCOUNTED}`, BOT_UA);

    expect(page.html).not.toContain('<script>window.pwned=1</script>');
    expect(ofType(page.html, 'Product')[0]?.name).toBe(HOSTILE_NAME);
  });

  it('out of stock: still 200 and indexable, shows availability and alternatives', async () => {
    const page = await get(`/${OUT_OF_STOCK}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('index, follow');
    expect((ofType(page.html, 'Product')[0]?.offers as Record<string, unknown>).availability).toBe(
      'https://schema.org/OutOfStock',
    );
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

    // Missing from Magento: no product claims in structured data or social cards.
    expect(ofType(page.html, 'Product')).toEqual([]);
    expect(ofType(page.html, 'BreadcrumbList')).toEqual([]);
    expect(meta(page.html, 'og:title')).toBe('Chupaprecios'); // site default only
    expect(meta(page.html, 'og:image')).toBeNull();
    expect(page.html).not.toContain(`<title>${chapiFound.data.title}`);

    // The shell (with the skeleton) arrived before the scraper answered.
    const [chapi] = chapiCalls();
    expect(chapi?.body).toEqual({ sku: MISSING_SKU, store: 'ebay', engine_id: 'api' });
    const shellChunk = page.chunks.find((c) => c.text.includes('data-testid="pdp-skeleton"'));
    expect(shellChunk!.seq).toBeLessThan(chapi!.respondedSeq!);
    expect(shellChunk!.text).not.toContain(chapiFound.data.title);

    // The mutation runs after the scraper call and after the response completed.
    const [mutation] = await waitForCalls(mutations, 1);
    expect(mutation?.body.variables).toEqual({ sku: MISSING_SKU, vendor: 'ebay' });
    expect(mutation!.receivedSeq).toBeGreaterThan(chapi!.respondedSeq!);
    expect(mutation!.receivedSeq).toBeGreaterThan(page.serverDoneSeq);
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

describe('PDP — sku search jump /{vendor}-{sku}-search.html', () => {
  const productByRoute = () => backends.callsTo('magento', 'ProductByRoute');

  it('user: 200 with the scraped product (not the Magento placeholder), noindex, canonical to the product url', async () => {
    const page = await get(`/${SKU_SEARCH}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${SKU_SEARCH_PRODUCT_URL}`);
    expect(page.html).toContain('DEWALT Kit de combo');
    expect(page.html).toContain('$4,434.60');
    expect(page.html).not.toContain('Carmina Earrings');

    // Missing-product rules: no product claims in structured data or the title.
    expect(ofType(page.html, 'Product')).toEqual([]);
    expect(page.html).not.toContain(`<title>${chapiAmazon.data.title}`);

    // Magento route() is never asked; one CHAPI call shared by the head and the body.
    expect(productByRoute()).toEqual([]);
    expect(chapiCalls().map((c) => c.body)).toEqual([
      { sku: 'B00IJ0ALYS', store: 'amazon', engine_id: 'direct' },
    ]);

    // Same copy request as any scraped product, after the response.
    const [mutation] = await waitForCalls(mutations, 1);
    expect(mutation?.body.variables).toEqual({ sku: 'B00IJ0ALYS', vendor: 'amazon' });
    expect(mutation!.receivedSeq).toBeGreaterThan(page.serverDoneSeq);
  });

  it('bot: 404 like a missing product, without Magento route, scraper or mutation', async () => {
    const page = await get(`/${SKU_SEARCH}`, BOT_UA);

    expect(page.status).toBe(404);
    expect(robots(page.html)).toContain('noindex');
    expect(page.html).not.toContain('Carmina Earrings');
    await settle();
    expect(productByRoute()).toEqual([]);
    expect(chapiCalls()).toEqual([]);
    expect(mutations()).toEqual([]);
  });

  it('scraper not found: 200 noindex with the unavailable state, canonical to itself, no mutation', async () => {
    const page = await get(`/${SKU_SEARCH_MISS}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${SKU_SEARCH_MISS}`);
    expect(page.html).toContain('Producto no disponible');
    expect(page.html).toContain('/search.html?query=B0NOTFOUND&amp;store=amazon');
    expect(page.html).not.toContain('Carmina Earrings');
    expect(productByRoute()).toEqual([]);
    expect(chapiCalls()).toHaveLength(1);
    await settle();
    expect(mutations()).toEqual([]);
  });

  it('scraper failure: 200 noindex with the unavailable state and no mutation', async () => {
    const page = await get(`/${SKU_SEARCH_FAILURE}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${SKU_SEARCH_FAILURE}`);
    expect(page.html).toContain('Producto no disponible');
    expect(page.html).not.toContain('Carmina Earrings');
    expect(productByRoute()).toEqual([]);
    expect(chapiCalls()).toHaveLength(1);
    await settle();
    expect(mutations()).toEqual([]);
  });
});

describe('PDP — sku search jump: timeouts and odd skus', () => {
  it('scraper timeout: 200 noindex, canonical to itself, unavailable state, no mutation', async () => {
    const page = await get(`/${SKU_SEARCH_SLOW}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${SKU_SEARCH_SLOW}`);
    expect(page.html).toContain('Producto no disponible');
    expect(page.html).not.toContain('Carmina Earrings');
    expect(chapiCalls()).toHaveLength(1);
    await settle();
    expect(mutations()).toEqual([]);
  });

  it('a sku containing "-" goes through Magento, whose placeholder is ignored', async () => {
    const page = await get(`/${SKU_SEARCH_HYPHEN}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(page.html).not.toContain('External URL Placeholder');
    expect(backends.callsTo('magento', 'ProductByRoute')).toHaveLength(1);
    // Legacy split: the scraper is asked for the first segment only.
    expect(chapiCalls().map((c) => c.body.sku)).toEqual(['ABC']);
  });
});

describe('PDP — Magento placeholder product for a vendor url it does not have', () => {
  it('user: renders the scraped product as a missing product, never the placeholder', async () => {
    // The canonical url of a found sku search page: Magento has no copy yet.
    const page = await get(`/${SKU_SEARCH_PRODUCT_URL}`, BROWSER_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${SKU_SEARCH_PRODUCT_URL}`);
    expect(page.html).toContain('DEWALT Kit de combo');
    expect(page.html).not.toContain('External URL Placeholder');
    expect(ofType(page.html, 'Product')).toEqual([]);
    expect(backends.callsTo('magento', 'ProductByRoute')).toHaveLength(1);
    expect(chapiCalls().map((c) => c.body)).toEqual([
      { sku: 'B00IJ0ALYS', store: 'amazon', engine_id: 'direct' },
    ]);
    const [mutation] = await waitForCalls(mutations, 1);
    expect(mutation?.body.variables).toEqual({ sku: 'B00IJ0ALYS', vendor: 'amazon' });
  });

  it('bot: 404 like a missing product, no scraper and no mutation', async () => {
    const page = await get(`/${SKU_SEARCH_PRODUCT_URL}`, BOT_UA);

    expect(page.status).toBe(404);
    expect(page.html).not.toContain('External URL Placeholder');
    await settle();
    expect(chapiCalls()).toEqual([]);
    expect(mutations()).toEqual([]);
  });
});

describe('PDP — Magento product whose sku is not in its url', () => {
  it.each([
    ['user', BROWSER_UA],
    ['bot', BOT_UA],
  ])(
    '%s: its url key + suffix is the url, so it stays an indexable Magento product',
    async (_who, ua) => {
      const page = await get(`/${OWN_URL}`, ua);

      expect(page.status).toBe(200);
      expect(robots(page.html)).toBe('index, follow');
      expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/${OWN_URL}`);
      expect(page.html).toContain('Own Key Lamp');
      expect(ofType(page.html, 'Product')).toHaveLength(1);
      expect(chapiCalls()).toEqual([]);
    },
  );
});

describe('PDP — add to cart (shared cart with PWA Studio)', () => {
  const submitButton = (html: string) =>
    /<form[^>]*data-testid="add-to-cart"[\s\S]*?(<button type="submit"[^>]*>)/.exec(html)?.[1];
  const DISABLED = /\sdisabled(=""|[\s>])/;

  it('renders an enabled add-to-cart form for an in-stock Magento product, without cart calls', async () => {
    const page = await get(`/${EXISTING}`, BROWSER_UA);

    const button = submitButton(page.html);
    expect(button).toBeDefined();
    expect(button).not.toMatch(DISABLED);
    expect(page.html).toContain('Agregar al carrito');
    // The cart lives in the browser: rendering a page never touches a Magento cart.
    await settle();
    const cartCalls = backends
      .callsTo('magento')
      .filter((call) => /cart|ItemCount/i.test(call.operation));
    expect(cartCalls).toEqual([]);
  });

  it('disables add to cart when Magento reports the product out of stock', async () => {
    const page = await get(`/${OUT_OF_STOCK}`, BROWSER_UA);

    expect(submitButton(page.html)).toMatch(DISABLED);
  });

  it('renders add to cart for a scraped product (Magento does not have it yet)', async () => {
    const page = await get(`/${MISSING}?var=428130345038`, BROWSER_UA);

    const button = submitButton(page.html);
    expect(button).toBeDefined();
    expect(button).not.toMatch(DISABLED);
  });

  it('renders the mini-cart trigger in the header', async () => {
    const page = await get(`/${EXISTING}`, BROWSER_UA);

    expect(page.html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*data-slot="cart-trigger"/);
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
});

describe('site-wide SEO', () => {
  it('renders Organization and WebSite JSON-LD once per page', async () => {
    const page = await get(`/${EXISTING}`, BOT_UA);

    expect(ofType(page.html, 'Organization')).toHaveLength(1);
    const [website] = ofType(page.html, 'WebSite');
    expect(ofType(page.html, 'WebSite')).toHaveLength(1);
    expect(website?.potentialAction).toMatchObject({
      target: { urlTemplate: `${PUBLIC_BASE_URL}/search.html?query={search_term_string}` },
    });
  });

  it('serves robots.txt with the production rules and the runtime sitemap url', async () => {
    const response = await fetch(`${next.baseUrl}/robots.txt`, {
      headers: { 'User-Agent': BOT_UA },
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(text).toContain('Disallow: /checkout/');
    expect(text.match(/^Sitemap:.*$/gm)).toEqual([`Sitemap: ${PUBLIC_BASE_URL}/sitemap.xml`]);
    expect(backends.callsTo('magento')).toEqual([]);
  });
});
