// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecommendedProduct } from '@/modules/recommendations/domain/recommendation';
import type { RecommendationsLoader } from '@/modules/recommendations/ui/recommendation-sliders';
import {
  showsRecommendations,
  type SearchPageView,
  type SearchResults,
  type StoreListing,
} from '@/modules/search/application/search-page';
import type { SearchResult } from '@/modules/search/domain/search-result';
import { SearchPage } from '@/modules/search/ui/search-page';

const RETRY = '/search.html?query=taladro&store=amazon';

const result = (items: SearchResult['items'] = []): SearchResult => ({
  vendor: 'amazon',
  items,
  totalCount: items.length,
  pagination: { current: 1, totalPages: null, next: null, prev: null, links: [] },
  refinements: [],
  sorts: [],
  skippedItems: 0,
  duplicateItems: 0,
});

const listing = (overrides: Partial<StoreListing> = {}): StoreListing => ({
  store: 'amazon',
  pageSize: 16,
  filters: '',
  result: result([
    {
      uid: 'amazon-1',
      sku: 'B1',
      name: 'Taladro',
      urlKey: 'amazon-B1-taladro',
      relativeUrl: 'amazon-B1-taladro.html',
      image: null,
      price: null,
      availability: 'in_stock',
      brand: null,
      rating: null,
    },
  ]),
  failure: null,
  servedByFallback: false,
  ...overrides,
});

const view = (results: SearchResults, store = 'amazon'): SearchPageView => ({
  kind: 'page',
  query: results.kind === 'none' && results.reason === 'empty_query' ? '' : 'taladro',
  store,
  page: null,
  storeParams: '',
  results,
});

const recommended: RecommendedProduct = {
  uid: 'amazon-R1',
  sku: 'R1',
  name: 'Recomendado',
  urlKey: 'amazon-R1-recomendado',
  relativeUrl: 'amazon-R1-recomendado.html',
  image: null,
  price: null,
  availability: 'unknown',
  rating: null,
};

afterEach(() => {
  document.body.innerHTML = '';
});

function render(pageView: SearchPageView, load: RecommendationsLoader) {
  document.body.innerHTML = renderToStaticMarkup(
    <SearchPage
      view={pageView}
      retryUrl={RETRY}
      loadSortOptions={() => Promise.resolve([])}
      loadRecommendations={load}
    />,
  );
  return document.body;
}

const cases = {
  'single store with results': view({ kind: 'single', listing: listing() }),
  'single store without results': view({
    kind: 'single',
    listing: listing({ result: result([]) }),
  }),
  'single store answered by a fallback store': view({
    kind: 'single',
    listing: listing({ servedByFallback: true }),
  }),
  'a failed single-store search': view({
    kind: 'single',
    listing: listing({ result: null, failure: 'timeout' }),
  }),
  chupachoice: view({ kind: 'multi', listings: [listing()] }, 'chupachoice'),
  bots: view({ kind: 'none', reason: 'bot' }),
  'a blank query': view({ kind: 'none', reason: 'empty_query' }),
} as const;

describe('search page recommendation sliders', () => {
  it.each([
    'single store with results',
    'single store without results',
    'single store answered by a fallback store',
  ] as const)('are shown (streamed, after the results) for a %s', (name) => {
    const load = vi.fn<RecommendationsLoader>(() => new Promise(() => {}));

    const body = render(cases[name], load);

    expect(showsRecommendations(cases[name])).toBe(true);
    expect(load.mock.calls.map(([type]) => type)).toEqual(['tendency', 'also_bought', 'recently']);
    const sliders = body.querySelector('[data-recommendations]');
    expect(sliders).not.toBeNull();
    const results = body.querySelector('[data-search-state], [data-search-count]');
    expect(
      results !== null &&
        sliders !== null &&
        Boolean(results.compareDocumentPosition(sliders) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it.each(['a failed single-store search', 'chupachoice', 'bots', 'a blank query'] as const)(
    'are not shown, and Magento is never asked, for %s',
    (name) => {
      const load = vi.fn<RecommendationsLoader>(() => Promise.resolve([recommended]));

      const body = render(cases[name], load);

      expect(showsRecommendations(cases[name])).toBe(false);
      expect(load).not.toHaveBeenCalled();
      expect(body.querySelector('[data-recommendations]')).toBeNull();
    },
  );

  it('are not shown without a loader (the page works without recommendations)', () => {
    document.body.innerHTML = renderToStaticMarkup(
      <SearchPage
        view={cases['single store with results']}
        retryUrl={RETRY}
        loadSortOptions={() => Promise.resolve([])}
      />,
    );

    expect(document.querySelector('[data-recommendations]')).toBeNull();
  });
});
