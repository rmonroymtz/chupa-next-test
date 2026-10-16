import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sortBy from '../fixtures/chapi/search-sort-by.amazon-taladro.json';
import amazonDewalt from '../fixtures/chapi/search.amazon-taladro.dewalt.json';
import amazonTaladro from '../fixtures/chapi/search.amazon-taladro.json';
import amazonPage2 from '../fixtures/chapi/search.amazon-taladro.page-2.json';
import ebayTaladro from '../fixtures/chapi/search.ebay-taladro.json';
import alsoBought from '../fixtures/magento/random-products.also-bought.json';
import recently from '../fixtures/magento/random-products.recently.json';
import tendency from '../fixtures/magento/random-products.tendency.json';
import storeConfig from '../fixtures/magento/store-config.json';
import { startMockBackends, type MockBackends } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PUBLIC_BASE_URL = 'https://chupaprecios.com.mx';
const GRID_PER_PAGE = 16;
const CHAPI_SEARCH_TIMEOUT_MS = 1_000;
const RECOMMENDATIONS_TIMEOUT_MS = 1_000;
/** Recorded staging `randomProducts` answers, by slider type. */
const RANDOM_PRODUCTS = {
  tendency: { body: tendency },
  also_bought: { body: alsoBought },
  recently: { body: recently },
};

/** Links of the recorded amazon search: the DEWALT refinement and page 2. */
const DEWALT_LINK = amazonTaladro.data.refinements[0]!.links[0]!.link;
const PAGE_2_LINK = amazonTaladro.data.pagination.links[0]!.link;
/** A search response that carries its own sort options (staging never does). */
const WITH_SORTS = {
  ...amazonTaladro,
  data: {
    ...amazonTaladro.data,
    sorts: [{ title: 'Destacados', link: '/s?k=sierra&s=relevance', selected: true }],
  },
};

let backends: MockBackends;
let next: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {},
    storeConfig: { ...storeConfig.data.storeConfig, grid_per_page: GRID_PER_PAGE },
    chapi: {},
    chapiSearch: {
      'amazon:taladro': { body: amazonTaladro },
      [`amazon:taladro:${DEWALT_LINK}`]: { body: amazonDewalt },
      [`amazon:taladro:${PAGE_2_LINK}`]: { body: amazonPage2 },
      'amazon:sierra': { body: WITH_SORTS },
      'ebay:taladro': { body: ebayTaladro },
      'acme:taladro': { status: 500, body: { message: 'boom' } },
      'amazon:lento': { body: amazonTaladro, delayMs: CHAPI_SEARCH_TIMEOUT_MS * 3 },
      'amazon:roto': { status: 502, body: { message: 'bad gateway' } },
    },
    chapiSortBy: { 'amazon:taladro': { body: sortBy } },
    randomProducts: RANDOM_PRODUCTS,
    chapiDefaultDelayMs: 0,
  });
  next = await startNext({
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL,
    MAGENTO_TIMEOUT_MS: '3000',
    CHAPI_SEARCH_TIMEOUT_MS: String(CHAPI_SEARCH_TIMEOUT_MS),
    MAGENTO_RECOMMENDATIONS_TIMEOUT_MS: String(RECOMMENDATIONS_TIMEOUT_MS),
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
/** Product links of the search results (the recommendation sliders come after them). */
const cardLinks = (html: string) =>
  [
    ...(html.split('data-recommendations')[0] ?? '').matchAll(
      /<a href="\/((?:amazon|ebay|target|acme)-[^"]+\.html)"/g,
    ),
  ].map((m) => m[1]);
/**
 * Recommendation sliders in page order. Only the opening tags are read: React may outline
 * parts of a large streamed boundary (`<template id="P:…">`, filled later in the document),
 * so a slider's cards are not always inside its `<section>` in the raw html.
 */
const sliders = (html: string) =>
  [...html.matchAll(/<section data-recommendation="([^"]+)"/g)].map((match) => match[1]);
/** Slider headings as rendered (legacy title plus the red accent). */
const sliderTitle = (title: string, accent: string) =>
  `${title} <span class="text-brand-red">${accent}</span></h2>`;
const withoutTextSeparators = (html: string) => html.replaceAll('<!-- -->', '');
/** Product links after the results: the sliders' cards, sorted. */
const sliderLinks = (html: string) =>
  [
    ...html
      .split('data-recommendations')
      .slice(1)
      .join('')
      .matchAll(/<a href="\/((?:amazon|ebay|target|acme)-[^"]+\.html)"/g),
  ]
    .map((m) => m[1])
    .sort();
const sliderCalls = () => backends.callsTo('magento', 'GetRandomProducts');
const sections = (html: string) =>
  [...html.matchAll(/data-search-section="([^"]+)"/g)].map((match) => match[1]);
const searchCalls = () => backends.callsTo('chapi', '/api/v1/search/');
const sortCalls = () => backends.callsTo('chapi', '/api/v1/search/sort_by');
/** Every `/search.html` link of the page, decoded: [text, params]. */
const searchLinks = (html: string) =>
  [...html.matchAll(/<a\b[^>]*href="(\/search\.html\?[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    ([, href, text]) => ({
      text: (text ?? '').replace(/<[^>]+>/g, ''),
      params: Object.fromEntries(
        new URLSearchParams((href ?? '').replaceAll('&amp;', '&').split('?')[1]),
      ),
    }),
  );
/** The RSC payload (flight data) inlined in the html, unescaped. */
const flightData = (html: string) =>
  [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
    .map(([, chunk]) => JSON.parse(chunk ?? '""') as string)
    .join('');
/** The search analytics events the page hands to its `TrackEvent` islands (their props). */
const searchEvents = (html: string) => {
  const flight = flightData(html);
  return [...flight.matchAll(/\{"type":"Search(?:Requested|ResultsViewed)"/g)].map(
    ({ index }) =>
      JSON.parse(balancedObject(flight, index)) as {
        type: string;
        store: string;
        items?: unknown[];
      },
  );
};
/** The JSON object starting at `start` (string-aware brace matching). */
function balancedObject(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  for (let at = start; at < text.length; at += 1) {
    const char = text[at];
    if (inString) {
      if (char === '\\') at += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return text.slice(start, at + 1);
  }
  throw new Error('unterminated object in the flight data');
}
/** Magento calls other than the store config, the header menu and the sliders (`sliderCalls`). */
const otherMagentoCalls = () =>
  backends
    .callsTo('magento')
    .filter((call) => !['StoreConfig', 'HeaderMenu', 'GetRandomProducts'].includes(call.operation));

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
    expect(acme).toContain('No pudimos consultar esta tienda en este momento');
    const target = /data-search-section="target"[\s\S]*?<\/section>/.exec(page.html)?.[0] ?? '';
    expect(target).toContain('data-search-state="empty"');
  });

  it('single store: refinement, pagination and (streamed) sort links carry CHAPI links as storeParams', async () => {
    const page = await get('/search.html?query=taladro&store=amazon');
    const links = searchLinks(page.html);

    const option = (text: string) => links.find((link) => link.text === text)?.params;
    expect(option('DEWALT')).toEqual({
      query: 'taladro',
      store: 'amazon',
      page: '1',
      storeParams: DEWALT_LINK,
    });
    expect(option('2')).toEqual({
      query: 'taladro',
      store: 'amazon',
      page: '2',
      storeParams: PAGE_2_LINK,
    });
    expect(option('Siguiente')).toEqual({
      query: 'taladro',
      store: 'amazon',
      page: '2',
      storeParams: amazonTaladro.data.pagination.next,
    });
    expect(page.html).toMatch(/<span aria-current="page"[^>]*>1<\/span>/);
    expect(option('Precio: Del más bajo al más alto')).toEqual({
      query: 'taladro',
      store: 'amazon',
      page: '1',
      storeParams: sortBy.data[1]!.link,
    });
    // No on-page store tabs (the header search bar switches stores, as in the legacy PWA).
    expect(page.html).not.toContain('aria-label="Tiendas"');
    expect(page.html).not.toContain('Limpiar filtros');
    // The search response has no sorts: one sort_by call with the same search.
    expect(sortCalls().map((call) => call.body)).toEqual([
      { filters: '', query: 'taladro', store: 'amazon', engine_id: 'direct', max_results: 16 },
    ]);
    // The header search bar shows the current search, in the first (and only) render.
    expect(page.html.match(/id="site-search-query"/g)).toHaveLength(1);
    expect(page.html).toMatch(/<input id="site-search-query"[^>]*value="taladro"/);
    expect(page.html).toMatch(/<input type="radio"[^>]*name="store" checked="" value="amazon"/);
  });

  it('a refinement link round trip: CHAPI gets the link byte for byte; the checked option removes it', async () => {
    const page = await get(
      `/search.html?query=taladro&store=amazon&page=1&storeParams=${encodeURIComponent(DEWALT_LINK)}`,
    );

    expect(searchCalls().map((call) => call.body.filters)).toEqual([DEWALT_LINK]);
    const dewalt =
      /<a\b[^>]*aria-current="true"[^>]*aria-label="Eliminar filtro &quot;DEWALT&quot;\."[^>]*>/.exec(
        page.html,
      );
    expect(dewalt).not.toBeNull();
    const links = searchLinks(page.html);
    expect(links.find((link) => link.text === 'DEWALT')?.params.storeParams).toBe(
      amazonDewalt.data.refinements[0]!.links[0]!.link,
    );
    expect(links.find((link) => link.text === 'Limpiar filtros')?.params).toEqual({
      query: 'taladro',
      store: 'amazon',
      page: '1',
    });
    expect(sortCalls().map((call) => call.body.filters)).toEqual([DEWALT_LINK]);
  });

  it('page 2 through its pagination link: page shown as current, prev back to page 1', async () => {
    const page = await get(
      `/search.html?query=taladro&store=amazon&page=2&storeParams=${encodeURIComponent(PAGE_2_LINK)}`,
    );

    expect(searchCalls().map((call) => call.body.filters)).toEqual([PAGE_2_LINK]);
    expect(page.html).toMatch(/<span aria-current="page"[^>]*>2<\/span>/);
    const links = searchLinks(page.html);
    expect(links.find((link) => link.text === 'Anterior')?.params).toEqual({
      query: 'taladro',
      store: 'amazon',
      page: '1',
      storeParams: amazonPage2.data.pagination.prev,
    });
  });

  it('no sort_by call when the search response has its own sorts', async () => {
    const page = await get('/search.html?query=sierra&store=amazon');

    expect(sortCalls()).toHaveLength(0);
    expect(searchLinks(page.html).find((link) => link.text === 'Destacados')?.params).toEqual({
      query: 'sierra',
      store: 'amazon',
      page: '1',
      storeParams: '/s?k=sierra&s=relevance',
    });
  });

  it('chupachoice: "Ver MÁS productos" for stores with results, no sort call', async () => {
    const page = await get('/search.html?query=taladro');

    const more = searchLinks(page.html).filter((link) => link.text === 'Ver MÁS productos');
    expect(more.map((link) => link.params)).toEqual([
      { query: 'taladro', store: 'amazon', page: '1' },
      { query: 'taladro', store: 'ebay', page: '1' },
    ]);
    expect(sortCalls()).toHaveLength(0);
  });
});

describe('search page: analytics events', () => {
  it('single store with results: the search and the result list with the real price and brand', async () => {
    const page = await get('/search.html?query=taladro&store=amazon');

    const [requested, viewed, ...rest] = searchEvents(page.html);
    expect(rest).toEqual([]);
    expect(requested).toEqual({ type: 'SearchRequested', query: 'taladro', store: 'amazon' });
    const first = amazonTaladro.data.products[0]!;
    expect(viewed).toMatchObject({
      type: 'SearchResultsViewed',
      query: 'taladro',
      store: 'amazon',
    });
    expect(viewed?.items).toHaveLength(cardLinks(page.html).length);
    expect(viewed?.items?.[0]).toEqual({
      sku: first.asin,
      name: expect.any(String),
      price: first.price.current_price,
      brand: first.brand || null,
      index: 1,
    });
  });

  it('failed search or no results: the search only', async () => {
    for (const query of ['roto', 'nada']) {
      const page = await get(`/search.html?query=${query}&store=amazon`);

      expect(searchEvents(page.html)).toEqual([
        { type: 'SearchRequested', query, store: 'amazon' },
      ]);
    }
  });

  it.each([
    ['chupachoice', '/search.html?query=taladro', BROWSER_UA],
    ['a blank query', '/search.html?query=%20&store=amazon', BROWSER_UA],
    ['a bot', '/search.html?query=taladro&store=amazon', BOT_UA],
  ])('none for %s', async (_, path, userAgent) => {
    const page = await get(path, userAgent);

    expect(searchEvents(page.html)).toEqual([]);
  });
});

describe('search page: recommendation sliders', () => {
  const recorded = (fixture: typeof tendency) =>
    fixture.data.randomProducts.products.map((product) => product.link);

  it('single store with results: the three legacy sliders after the results, from Magento', async () => {
    const page = await get('/search.html?query=taladro&store=amazon');

    expect(page.status).toBe(200);
    expect(cardLinks(page.html)).toHaveLength(amazonTaladro.data.products.length);
    expect(sliders(page.html)).toEqual(['tendency', 'also_bought', 'recently']);
    const html = withoutTextSeparators(page.html);
    expect(html).toContain(sliderTitle('Los productos en', 'tendencia'));
    expect(html).toContain(sliderTitle('Otras personas', 'también compraron'));
    expect(html).toContain(sliderTitle('Productos más buscados', 'recientemente'));
    expect(sliderLinks(page.html)).toEqual(
      [...recorded(tendency), ...recorded(alsoBought), ...recorded(recently)].sort(),
    );
    expect(sliderCalls().map((call) => call.body.variables)).toEqual(
      expect.arrayContaining([
        { limit: 30, type: 'tendency' },
        { limit: 30, type: 'also_bought' },
        { limit: 30, type: 'recently' },
      ]),
    );
    expect(sliderCalls()).toHaveLength(3);
  });

  it('single store without results: the sliders too', async () => {
    const page = await get('/search.html?query=nada&store=amazon');

    expect(page.html).toContain('data-search-state="empty"');
    expect(sliders(page.html)).toEqual(['tendency', 'also_bought', 'recently']);
  });

  it.each([
    ['a failed search', '/search.html?query=roto&store=amazon', BROWSER_UA],
    ['chupachoice', '/search.html?query=taladro', BROWSER_UA],
    ['a blank query', '/search.html?query=%20&store=amazon', BROWSER_UA],
    ['a bot', '/search.html?query=taladro&store=amazon', BOT_UA],
  ])('none, and no Magento call, for %s', async (_, path, userAgent) => {
    const page = await get(path, userAgent);

    expect(page.status).toBe(200);
    expect(page.html).not.toContain('data-recommendation');
    expect(sliderCalls()).toEqual([]);
  });

  it('a Magento failure or timeout hides only the affected sliders; the results stay 200', async () => {
    backends.setRandomProducts({
      tendency: { status: 503, body: { message: 'Service Unavailable' } },
      also_bought: { body: alsoBought, delayMs: RECOMMENDATIONS_TIMEOUT_MS * 3 },
      recently: { body: recently },
    });
    try {
      const page = await get('/search.html?query=taladro&store=amazon');

      expect(page.status).toBe(200);
      expect(cardLinks(page.html)).toHaveLength(amazonTaladro.data.products.length);
      expect(sliders(page.html)).toEqual(['recently']);
      expect(sliderLinks(page.html)).toEqual(recorded(recently).sort());
    } finally {
      backends.setRandomProducts(RANDOM_PRODUCTS);
    }
  });

  it('every slider failing: the results page without sliders', async () => {
    backends.setRandomProducts({});
    try {
      const page = await get('/search.html?query=taladro&store=amazon');

      expect(page.status).toBe(200);
      expect(cardLinks(page.html)).toHaveLength(amazonTaladro.data.products.length);
      expect(sliders(page.html)).toEqual([]);
      expect(sliderLinks(page.html)).toEqual([]);
    } finally {
      backends.setRandomProducts(RANDOM_PRODUCTS);
    }
  });
});
