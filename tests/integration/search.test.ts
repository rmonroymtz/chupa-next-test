import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import amazonTaladro from '../fixtures/chapi/search.amazon-taladro.json';
import ebayTaladro from '../fixtures/chapi/search.ebay-taladro.json';
import storeConfig from '../fixtures/magento/store-config.json';
import { startMockBackends, type MockBackends } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PUBLIC_BASE_URL = 'https://chupaprecios.com.mx';
const GRID_PER_PAGE = 16;
const CHAPI_SEARCH_TIMEOUT_MS = 1_000;

let backends: MockBackends;
let next: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {},
    storeConfig: { ...storeConfig.data.storeConfig, grid_per_page: GRID_PER_PAGE },
    chapi: {},
    chapiSearch: {
      'amazon:taladro': { body: amazonTaladro },
      'ebay:taladro': { body: ebayTaladro },
      'acme:taladro': { status: 500, body: { message: 'boom' } },
      'amazon:lento': { body: amazonTaladro, delayMs: CHAPI_SEARCH_TIMEOUT_MS * 3 },
      'amazon:roto': { status: 502, body: { message: 'bad gateway' } },
    },
    chapiDefaultDelayMs: 0,
  });
  next = await startNext({
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL,
    MAGENTO_TIMEOUT_MS: '3000',
    CHAPI_SEARCH_TIMEOUT_MS: String(CHAPI_SEARCH_TIMEOUT_MS),
    LOG_LEVEL: 'warn',
  });
});

afterAll(async () => {
  await next?.stop();
  await backends?.close();
});

async function get(path: string, userAgent = BROWSER_UA) {
  backends.reset();
  const response = await fetch(`${next.baseUrl}${path}`, {
    headers: { 'User-Agent': userAgent },
    redirect: 'manual',
  });
  return {
    status: response.status,
    location: response.headers.get('location'),
    html: await response.text(),
  };
}

const robots = (html: string) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? null;
const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null;
const h1 = (html: string) => /<h1[^>]*>([^<]*)<\/h1>/.exec(html)?.[1] ?? null;
const cardLinks = (html: string) =>
  [...html.matchAll(/<a href="\/((?:amazon|ebay|target|acme)-[^"]+\.html)"/g)].map((m) => m[1]);
const sections = (html: string) =>
  [...html.matchAll(/data-search-section="([^"]+)"/g)].map((match) => match[1]);
const searchCalls = () => backends.callsTo('chapi', '/api/v1/search/');
/** Magento calls other than the store config and the layout's header menu. */
const otherMagentoCalls = () =>
  backends
    .callsTo('magento')
    .filter((call) => !['StoreConfig', 'HeaderMenu'].includes(call.operation));

describe('search page', () => {
  it('single store: 200, results grid, title with the query and noindex', async () => {
    const page = await get('/search.html?query=taladro&store=amazon');

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(title(page.html)).toBe('Búsqueda: taladro | Chupaprecios');
    expect(h1(page.html)).toBe('Resultados para «taladro»');
    expect(cardLinks(page.html)).toHaveLength(amazonTaladro.data.products.length);
    expect(cardLinks(page.html)[0]).toMatch(/^amazon-B0CC1RHJY1-power-drill-cordless/);
    expect(otherMagentoCalls()).toEqual([]);
    expect(searchCalls().map((call) => call.body)).toEqual([
      { filters: '', query: 'taladro', store: 'amazon', engine_id: 'direct', page_size: 16 },
    ]);
  });

  it('empty query: 200 without results and without any search call', async () => {
    const page = await get('/search.html?query=%20&store=amazon');

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(title(page.html)).toBe('Búsqueda | Chupaprecios');
    expect(h1(page.html)).toBe('Búsqueda');
    expect(otherMagentoCalls()).toEqual([]);
    expect(searchCalls()).toHaveLength(0);
  });

  it('no results: 200 with the empty state', async () => {
    const page = await get('/search.html?query=nada&store=amazon');

    expect(page.status).toBe(200);
    expect(page.html).toContain('data-search-state="empty"');
    expect(page.html).toContain('No encontramos resultados para «<!-- -->nada<!-- -->».');
    expect(cardLinks(page.html)).toHaveLength(0);
  });

  it.each([
    ['timeout', 'lento'],
    ['error', 'roto'],
  ])('CHAPI %s: 200 error state with a retry link and noindex', async (_, query) => {
    const page = await get(`/search.html?query=${query}&store=amazon`);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(page.html).toContain('No pudimos cargar los resultados.');
    expect(page.html).toContain(
      `<a href="/search.html?query=${query}&amp;store=amazon" class="mt-2 inline-block font-semibold underline">Reintentar</a>`,
    );
  });

  it.each(['walmart', 'homedepot', 'nope'])(
    'store=%s: 307 to chupachoice without storeParams and without backend calls',
    async (store) => {
      const page = await get(`/search.html?query=taladro&store=${store}&storeParams=%2Fs&page=2`);

      expect(page.status).toBe(307);
      expect(page.location).toBe('/search.html?query=taladro&store=chupachoice&page=2');
      expect(otherMagentoCalls()).toEqual([]);
      expect(searchCalls()).toHaveLength(0);
    },
  );

  it('bots: 200 with the query, noindex, and no CHAPI call', async () => {
    const page = await get('/search.html?query=taladro&store=amazon', BOT_UA);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('noindex, follow');
    expect(h1(page.html)).toBe('Resultados para «taladro»');
    expect(cardLinks(page.html)).toHaveLength(0);
    expect(otherMagentoCalls()).toEqual([]);
    expect(searchCalls()).toHaveLength(0);
  });

  it('chupachoice (default store): one section per store, each one independent', async () => {
    const page = await get('/search.html?query=taladro');

    expect(page.status).toBe(200);
    expect(sections(page.html)).toEqual(['amazon', 'ebay', 'target', 'acme']);
    expect(
      searchCalls()
        .map((call) => [call.body.store, call.body.page_size])
        .sort(),
    ).toEqual(
      [
        ['acme', 6],
        ['amazon', 12],
        ['ebay', 6],
        ['target', 6],
      ].sort(),
    );
    expect(cardLinks(page.html)).toHaveLength(
      amazonTaladro.data.products.length + ebayTaladro.data.products.length,
    );
    const acme = /data-search-section="acme"[\s\S]*?<\/section>/.exec(page.html)?.[0] ?? '';
    expect(acme).toContain('No pudimos cargar los resultados.');
    const target = /data-search-section="target"[\s\S]*?<\/section>/.exec(page.html)?.[0] ?? '';
    expect(target).toContain('data-search-state="empty"');
  });
});
