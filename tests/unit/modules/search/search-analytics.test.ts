import { describe, expect, it } from 'vitest';
import type {
  SearchPageView,
  SearchResults,
  StoreListing,
} from '@/modules/search/application/search-page';
import {
  isSameSearchNavigation,
  searchPageEvents,
} from '@/modules/search/application/search-analytics';
import type { SearchItem, SearchResult } from '@/modules/search/domain/search-result';

const item = (index: number, overrides: Partial<SearchItem> = {}): SearchItem => ({
  uid: `amazon-${index}`,
  sku: `B00000000${index}`,
  name: `Taladro ${index}`,
  urlKey: `amazon-B00000000${index}-taladro-${index}`,
  relativeUrl: `amazon-B00000000${index}-taladro-${index}.html`,
  image: null,
  price: {
    final: { amount: 100 * index + 0.5, currency: 'MXN' },
    regular: { amount: 200 * index, currency: 'MXN' },
    discount: null,
  },
  availability: 'in_stock',
  brand: 'DEWALT',
  rating: null,
  ...overrides,
});

const result = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  vendor: 'amazon',
  items: [item(1), item(2)],
  totalCount: 2,
  pagination: { current: 1, totalPages: null, next: null, prev: null, links: [] },
  refinements: [],
  sorts: [],
  skippedItems: 0,
  duplicateItems: 0,
  ...overrides,
});

const listing = (overrides: Partial<StoreListing> = {}): StoreListing => ({
  store: 'amazon',
  pageSize: 16,
  filters: '',
  result: result(),
  failure: null,
  servedByFallback: false,
  ...overrides,
});

const view = (results: SearchResults, overrides: Partial<SearchPageView> = {}): SearchPageView => ({
  kind: 'page',
  query: 'taladro',
  store: 'amazon',
  page: null,
  storeParams: '',
  results,
  ...overrides,
});

const single = (
  overrides: Partial<StoreListing> = {},
  viewOverrides: Partial<SearchPageView> = {},
) => view({ kind: 'single', listing: listing(overrides) }, viewOverrides);

describe('searchPageEvents', () => {
  it('single store with results: the search, keyed by store and query, and the result list', () => {
    const events = searchPageEvents(single());

    expect(events.requested).toEqual({
      key: 'amazon:taladro',
      event: { type: 'SearchRequested', query: 'taladro', store: 'amazon' },
    });
    expect(events.resultsViewed?.event).toEqual({
      type: 'SearchResultsViewed',
      query: 'taladro',
      store: 'amazon',
      items: [
        { sku: 'B000000001', name: 'Taladro 1', price: 100.5, brand: 'DEWALT', index: 1 },
        { sku: 'B000000002', name: 'Taladro 2', price: 200.5, brand: 'DEWALT', index: 2 },
      ],
    });
  });

  it('items: null price and brand when the result has none, 1-based index in the rendered order', () => {
    const events = searchPageEvents(
      single({ result: result({ items: [item(3, { price: null, brand: null }), item(1)] }) }),
    );

    expect(events.resultsViewed?.event.items).toEqual([
      { sku: 'B000000003', name: 'Taladro 3', price: null, brand: null, index: 1 },
      { sku: 'B000000001', name: 'Taladro 1', price: 100.5, brand: 'DEWALT', index: 2 },
    ]);
  });

  it('result list key: one per distinct response (store, query, page and CHAPI link)', () => {
    const first = searchPageEvents(single());
    const page2 = searchPageEvents(single({}, { page: 2, storeParams: '/s?k=taladro&page=2' }));
    const sorted = searchPageEvents(single({}, { page: 1, storeParams: '/s?k=taladro&s=price' }));

    const keys = [first, page2, sorted].map((events) => events.resultsViewed?.key);
    expect(new Set(keys).size).toBe(3);
    // The search itself stays the same pair, so it keeps its key.
    expect(new Set([first, page2, sorted].map((events) => events.requested?.key))).toEqual(
      new Set(['amazon:taladro']),
    );
  });

  it('fallback: the search is for the requested store, the list for the store that answered', () => {
    const events = searchPageEvents(
      single({ servedByFallback: true, result: result({ vendor: 'ebay' }) }),
    );

    expect(events.requested?.event.store).toBe('amazon');
    expect(events.resultsViewed?.event.store).toBe('ebay');
  });

  it('empty result: the search only', () => {
    const events = searchPageEvents(single({ result: result({ items: [] }) }));

    expect(events.requested?.event.type).toBe('SearchRequested');
    expect(events.resultsViewed).toBeNull();
  });

  it('failed search: the search only (it was requested even if CHAPI failed)', () => {
    const events = searchPageEvents(single({ result: null, failure: 'timeout' }));

    expect(events.requested?.event.type).toBe('SearchRequested');
    expect(events.resultsViewed).toBeNull();
  });

  it.each([
    ['chupachoice', view({ kind: 'multi', listings: [listing()] }, { store: 'chupachoice' })],
    ['a blank query', view({ kind: 'none', reason: 'empty_query' }, { query: '' })],
    ['a bot', view({ kind: 'none', reason: 'bot' })],
  ])('no events for %s', (_, page) => {
    expect(searchPageEvents(page)).toEqual({ requested: null, resultsViewed: null });
  });
});

describe('isSameSearchNavigation', () => {
  const at = (search: string, origin = 'https://chupaprecios.com.mx', path = '/search.html') =>
    `${origin}${path}?${search}`;
  const CURRENT_PAGE_2 = at('query=taladro&store=amazon&page=2&storeParams=%2Fs%3Fpage%3D2');

  it('true for a page, sort or filter link followed from the same search', () => {
    expect(isSameSearchNavigation(at('query=taladro&store=amazon&page=1'), CURRENT_PAGE_2)).toBe(
      true,
    );
  });

  it('true for "Limpiar filtros" and a repeated search from the search bar (same pair, no CHAPI link)', () => {
    expect(
      isSameSearchNavigation(
        at('query=taladro&store=amazon&page=1&storeParams=%2Fs%3Frh%3Ddewalt'),
        at('query=taladro&store=amazon&page=1'),
      ),
    ).toBe(true);
  });

  it('true for a CHAPI link of a fallback answer (the links carry the store that answered)', () => {
    expect(
      isSameSearchNavigation(
        at('query=taladro&store=amazon'),
        at('query=taladro&store=ebay&page=2&storeParams=%2Fsch%3F_pgn%3D2'),
      ),
    ).toBe(true);
  });

  it.each([
    ['no referrer', ''],
    ['another page of the site', 'https://chupaprecios.com.mx/amazon-B0001-taladro.html'],
    ['another site', at('query=taladro&store=amazon', 'https://www.google.com')],
    ['another query', at('query=sierra&store=amazon')],
    [
      'another store (search bar tab or "Ver MÁS productos")',
      at('query=taladro&store=chupachoice'),
    ],
    ['an unparsable referrer', 'not a url'],
  ])('false (a new search) from %s', (_, referrer) => {
    expect(isSameSearchNavigation(referrer, at('query=taladro&store=amazon&page=1'))).toBe(false);
  });

  it('the query is compared as the page reads it (trimmed)', () => {
    expect(
      isSameSearchNavigation(
        at('query=%20taladro%20&store=amazon'),
        at('query=taladro&store=amazon&page=2&storeParams=x'),
      ),
    ).toBe(true);
  });
});
