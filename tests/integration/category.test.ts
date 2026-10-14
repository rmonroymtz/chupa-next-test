import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import laptops from '../fixtures/magento/category.laptops.json';
import storeConfig from '../fixtures/magento/store-config.json';
import { startMockBackends, type MockBackends } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const PUBLIC_BASE_URL = 'https://chupaprecios.com.mx';
/** Production and staging `grid_per_page` (Magento's default is 12). */
const GRID_PER_PAGE = 16;

// The layout's title template adds the site name, so the meta title carries none.
const LAPTOPS = { ...laptops.data.categoryList[0]!, meta_title: 'Laptops baratas' };
const LAPTOPS_URL = '/electronica/computacion/laptops.html';

const categoryRoute = (relativeUrl: string, uid: string) => ({
  type: 'CATEGORY',
  redirect_code: 0,
  relative_url: relativeUrl,
  uid,
});

const category = (uid: string, name: string, urlPath: string) => ({
  ...LAPTOPS,
  uid,
  name,
  url_key: urlPath.split('/').pop(),
  url_path: urlPath,
  description: null,
  meta_title: null,
  meta_description: null,
  breadcrumbs: null,
});

const product = (index: number) => ({
  uid: `p${index}`,
  sku: `B0LAPTOP${String(index).padStart(2, '0')}`,
  name: `Laptop número ${index}`,
  url_key: `amazon-B0LAPTOP${String(index).padStart(2, '0')}-laptop-${index}`,
  url_suffix: '.html',
  stock_status: 'IN_STOCK',
  small_image: null,
  price_range: {
    minimum_price: {
      final_price: { value: 9000 + index, currency: 'MXN' },
      regular_price: { value: 9000 + index, currency: 'MXN' },
      discount: { amount_off: 0, percent_off: 0 },
    },
  },
});

/** 20 laptops at 16 per page: 2 pages. */
const LAPTOP_PRODUCTS = Array.from({ length: 20 }, (_, index) => product(index + 1));

let backends: MockBackends;
let next: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {
      'electronica/computacion/laptops.html': categoryRoute(
        'electronica/computacion/laptops.html',
        LAPTOPS.uid,
      ),
      'tabletas.html': categoryRoute('tabletas.html', 'VEFC'),
      'borrada.html': categoryRoute('borrada.html', 'Qk9S'),
      'caida.html': categoryRoute('caida.html', 'Q0FJ'),
      'productos-caidos.html': categoryRoute('productos-caidos.html', 'UENB'),
    },
    categories: {
      [LAPTOPS.uid]: LAPTOPS,
      VEFC: category('VEFC', 'Tabletas', 'tabletas'),
      Q0FJ: 'outage',
      UENB: category('UENB', 'Productos caídos', 'productos-caidos'),
    },
    categoryProducts: {
      [LAPTOPS.uid]: LAPTOP_PRODUCTS,
      UENB: 'outage',
    },
    storeConfig: { ...storeConfig.data.storeConfig, grid_per_page: GRID_PER_PAGE },
    chapi: {},
    chapiDefaultDelayMs: 0,
  });
  next = await startNext({
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL,
    MAGENTO_TIMEOUT_MS: '3000',
    LOG_LEVEL: 'warn',
  });
});

afterAll(async () => {
  await next?.stop();
  await backends?.close();
});

async function get(path: string) {
  backends.reset();
  const response = await fetch(`${next.baseUrl}${path}`, {
    headers: { 'User-Agent': BROWSER_UA },
    redirect: 'manual',
  });
  return {
    status: response.status,
    location: response.headers.get('location'),
    html: await response.text(),
  };
}

const robots = (html: string) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? null;
const canonical = (html: string) => /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null;
const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null;
const productLinks = (html: string) =>
  [...html.matchAll(/<a href="\/(amazon-B0LAPTOP\d+-laptop-\d+\.html)"/g)].map((match) => match[1]);
const pagination = (html: string) =>
  /<nav aria-label="Paginación"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? null;

describe('category pages', () => {
  it('category with products: 200, h1, first page of cards, canonical and index', async () => {
    const page = await get(LAPTOPS_URL);

    expect(page.status).toBe(200);
    expect(page.html).toContain('>Laptops</h1>');
    expect(page.html).toContain('al mejor precio.');
    expect(productLinks(page.html)).toEqual(
      LAPTOP_PRODUCTS.slice(0, GRID_PER_PAGE).map((item) => `${item.url_key}.html`),
    );
    expect(robots(page.html)).toBe('index, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}${LAPTOPS_URL}`);
    expect(title(page.html)).toBe('Laptops baratas | Chupaprecios');
    expect(page.html).toContain(
      '<meta name="description" content="Compra laptops importadas con envío a todo México."/>',
    );
    expect(pagination(page.html)).toContain(`href="${LAPTOPS_URL}?page=2"`);
    // One read per operation and request, shared by metadata and page, with the store's page size.
    expect(backends.callsTo('magento', 'CategoryByUid')).toHaveLength(1);
    const productCalls = backends.callsTo('magento', 'CategoryProducts');
    expect(productCalls.map((call) => call.body.variables)).toEqual([
      { uid: LAPTOPS.uid, currentPage: 1, pageSize: GRID_PER_PAGE },
    ]);
  });

  it('page 2: the remaining cards, canonical still the clean category url', async () => {
    const page = await get(`${LAPTOPS_URL}?page=2&utm_source=x`);

    expect(page.status).toBe(200);
    expect(productLinks(page.html)).toEqual(
      LAPTOP_PRODUCTS.slice(GRID_PER_PAGE).map((item) => `${item.url_key}.html`),
    );
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}${LAPTOPS_URL}`);
    expect(robots(page.html)).toBe('index, follow');
    // The first page links to the clean url; other parameters are kept.
    expect(pagination(page.html)).toContain(`href="${LAPTOPS_URL}?utm_source=x"`);
    expect(pagination(page.html)).toContain('aria-current="page"');
  });

  it('empty category: 200, noindex, empty state, no pagination', async () => {
    const page = await get('/tabletas.html');

    expect(page.status).toBe(200);
    expect(page.html).toContain('>Tabletas</h1>');
    expect(page.html).toContain('No hay productos en esta categoría.');
    expect(robots(page.html)).toBe('noindex, follow');
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/tabletas.html`);
    expect(pagination(page.html)).toBeNull();
  });

  it('category Magento routes but cannot find: 404', async () => {
    const page = await get('/borrada.html');

    expect(page.status).toBe(404);
  });

  it('invalid page: temporary redirect to the clean url, other parameters kept', async () => {
    const page = await get(`${LAPTOPS_URL}?page=abc&utm_source=x`);

    expect(page.status).toBe(307);
    expect(page.location).toBe(`${LAPTOPS_URL}?utm_source=x`);
  });

  it('page beyond the last one: temporary redirect to the clean url', async () => {
    const page = await get(`${LAPTOPS_URL}?page=9`);

    expect(page.status).toBe(307);
    expect(page.location).toBe(LAPTOPS_URL);
  });

  it.each([
    ['reading the category', '/caida.html'],
    ['reading its products', '/productos-caidos.html'],
  ])('Magento outage %s: 5xx, never 404', async (_, path) => {
    const page = await get(path);

    expect(page.status).toBeGreaterThanOrEqual(500);
  });
});
