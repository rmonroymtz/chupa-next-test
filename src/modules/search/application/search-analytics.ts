import type {
  SearchRequested,
  SearchResultItem,
  SearchResultsViewed,
} from '@/modules/analytics/domain/analytics-event';
import { SEARCH_PATH } from '@/modules/layout/domain/search';
import { getDisplayPrice } from '@/modules/product/domain/display-price';
import type { SearchPageView } from '@/modules/search/application/search-page';
import { parseSearchRequest } from '@/modules/search/domain/search-request';
import type { SearchItem } from '@/modules/search/domain/search-result';

/** An event and the React key that decides when it is reported again. */
export interface KeyedEvent<E> {
  readonly key: string;
  readonly event: E;
}

export interface SearchPageEvents {
  /** Legacy `SEARCH_REQUEST`: once per (query, store) search, even when CHAPI failed. */
  readonly requested: KeyedEvent<SearchRequested> | null;
  /** Legacy `SEARCH_RESPONSE`: every non-empty answer (each page, sort or filter). */
  readonly resultsViewed: KeyedEvent<SearchResultsViewed> | null;
}

const NO_EVENTS: SearchPageEvents = { requested: null, resultsViewed: null };

/**
 * The analytics events of a search page. Single-store searches only, as in
 * the legacy PWA: nothing for ChupaChoice, bots or a blank query.
 */
export function searchPageEvents(view: SearchPageView): SearchPageEvents {
  const { query, store, page, storeParams, results } = view;
  if (results.kind !== 'single') return NO_EVENTS;

  const requested: KeyedEvent<SearchRequested> = {
    key: `${store}:${query}`,
    event: { type: 'SearchRequested', query, store },
  };
  const { listing } = results;
  const { result } = listing;
  if (listing.failure !== null || result === null || result.items.length === 0) {
    return { requested, resultsViewed: null };
  }

  // The store that answered, as the fallback notice names it.
  const answeredBy = listing.servedByFallback ? result.vendor : listing.store;
  return {
    requested,
    resultsViewed: {
      key: JSON.stringify([store, query, page, storeParams]),
      event: {
        type: 'SearchResultsViewed',
        query,
        store: answeredBy,
        items: result.items.map(toResultItem),
      },
    },
  };
}

function toResultItem(item: SearchItem, position: number): SearchResultItem {
  return {
    sku: item.sku,
    name: item.name,
    // The price the card shows.
    price: getDisplayPrice(item)?.amount ?? null,
    brand: item.brand,
    index: position + 1,
  };
}

/**
 * True when the search page at `location` was reached from the same search
 * (same query, same store or a CHAPI link of it): a page, sort or filter
 * link, "Limpiar filtros" or the same search again. Every search navigation
 * is a full page load (plain links, GET search form), so this is how the
 * page tells a refinement from a new search. Without a usable referrer it is
 * a new search.
 */
export function isSameSearchNavigation(referrer: string, location: string): boolean {
  const before = searchRequestAt(referrer);
  const now = searchRequestAt(location);
  if (!before || !now || before.origin !== now.origin) return false;
  if (before.request.query !== now.request.query) return false;
  // A CHAPI link (`storeParams`) of a fallback answer carries the store that answered.
  return before.request.store === now.request.store || now.request.storeParams !== '';
}

function searchRequestAt(href: string) {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.pathname !== SEARCH_PATH) return null;
  const parsed = parseSearchRequest(url.searchParams);
  return parsed.kind === 'request' ? { origin: url.origin, request: parsed.request } : null;
}
