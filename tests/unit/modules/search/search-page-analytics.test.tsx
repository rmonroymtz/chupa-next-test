// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsEvent } from '@/modules/analytics/domain/analytics-event';
import type {
  SearchPageView,
  SearchResults,
  StoreListing,
} from '@/modules/search/application/search-page';
import type { SearchItem, SearchResult } from '@/modules/search/domain/search-result';
import { SearchPage, type SortOptionsLoader } from '@/modules/search/ui/search-page';

// Shows each tracked event in the markup, with whether it is conditional (shouldTrack).
vi.mock('@/modules/analytics/ui/track-event.client', () => ({
  TrackEvent: ({
    event,
    shouldTrack,
  }: {
    readonly event: AnalyticsEvent;
    readonly shouldTrack?: () => boolean;
  }) => (
    <i data-track-event={JSON.stringify(event)} data-conditional={shouldTrack ? 'true' : 'false'} />
  ),
}));

const item = (index: number): SearchItem => ({
  uid: `amazon-${index}`,
  sku: `B00000000${index}`,
  name: `Taladro ${index}`,
  urlKey: `amazon-B00000000${index}-taladro-${index}`,
  relativeUrl: `amazon-B00000000${index}-taladro-${index}.html`,
  image: null,
  price: {
    final: { amount: 499, currency: 'MXN' },
    regular: { amount: 499, currency: 'MXN' },
    discount: null,
  },
  availability: 'in_stock',
  brand: null,
  rating: null,
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

const noSorts: SortOptionsLoader = () => Promise.resolve([]);

/** The tracked events of the rendered page, in document order. */
function tracked(page: SearchPageView) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(
    <SearchPage view={page} retryUrl="/search.html?query=taladro" loadSortOptions={noSorts} />,
  );
  return [...container.querySelectorAll<HTMLElement>('[data-track-event]')].map((node) => ({
    event: JSON.parse(node.dataset.trackEvent ?? 'null') as AnalyticsEvent,
    conditional: node.dataset.conditional === 'true',
  }));
}

const SEARCH: AnalyticsEvent = { type: 'SearchRequested', query: 'taladro', store: 'amazon' };

describe('SearchPage: analytics events', () => {
  it('single store with results: the search (skipped for same-search links) and the result list', () => {
    expect(tracked(view({ kind: 'single', listing: listing() }))).toEqual([
      { event: SEARCH, conditional: true },
      {
        event: {
          type: 'SearchResultsViewed',
          query: 'taladro',
          store: 'amazon',
          items: [
            { sku: 'B000000001', name: 'Taladro 1', price: 499, brand: null, index: 1 },
            { sku: 'B000000002', name: 'Taladro 2', price: 499, brand: null, index: 2 },
          ],
        },
        conditional: false,
      },
    ]);
  });

  it('empty result: the search only', () => {
    const page = view({ kind: 'single', listing: listing({ result: result({ items: [] }) }) });

    expect(tracked(page)).toEqual([{ event: SEARCH, conditional: true }]);
  });

  it('failed search: the search only', () => {
    const page = view({ kind: 'single', listing: listing({ result: null, failure: 'error' }) });

    expect(tracked(page)).toEqual([{ event: SEARCH, conditional: true }]);
  });

  it('fallback: the result list names the store that answered', () => {
    const page = view({
      kind: 'single',
      listing: listing({ servedByFallback: true, result: result({ vendor: 'ebay' }) }),
    });

    const stores = tracked(page).map(({ event }) => ('store' in event ? event.store : null));
    expect(stores).toEqual(['amazon', 'ebay']);
  });

  it.each([
    ['chupachoice', view({ kind: 'multi', listings: [listing()] }, { store: 'chupachoice' })],
    ['a blank query', view({ kind: 'none', reason: 'empty_query' }, { query: '' })],
    ['a bot', view({ kind: 'none', reason: 'bot' })],
  ])('nothing for %s', (_, page) => {
    expect(tracked(page)).toEqual([]);
  });
});
