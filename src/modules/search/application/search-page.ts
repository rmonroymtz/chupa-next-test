import type { Logger } from 'pino';
import type { StoreSearchOutcome } from '@/modules/search/application/store-search';
import {
  CHUPACHOICE_LISTS,
  CHUPACHOICE_STORE,
  parseSearchRequest,
} from '@/modules/search/domain/search-request';
import type { SearchResult } from '@/modules/search/domain/search-result';
import type { MetricsEmitter } from '@/shared/observability/metrics';

/** Legacy page size when the store config gives none (`DEFAULT_PAGE_SIZE`). */
export const DEFAULT_SEARCH_PAGE_SIZE = 12;

export type SearchFailure = 'timeout' | 'error' | 'invalid';

/** One store's results (or failure) as the page renders it. */
export interface StoreListing {
  readonly store: string;
  readonly pageSize: number;
  /** CHAPI `filters` sent (`storeParams`); the sort options call needs the same value. */
  readonly filters: string;
  /** Null when the search failed. */
  readonly result: SearchResult | null;
  /** Null when the search answered (with or without items). */
  readonly failure: SearchFailure | null;
  /** True when CHAPI answered from another store (fallback notice). */
  readonly servedByFallback: boolean;
}

export type SearchResults =
  /** No search was run: blank query, or a bot (no backend call). */
  | { readonly kind: 'none'; readonly reason: 'empty_query' | 'bot' }
  | { readonly kind: 'single'; readonly listing: StoreListing }
  /** ChupaChoice: one listing per store, each one independently ok or failed. */
  | { readonly kind: 'multi'; readonly listings: readonly StoreListing[] };

export type SearchPageDecision =
  | {
      readonly kind: 'redirect';
      readonly reason: 'unknown_store';
      readonly location: string;
    }
  | {
      readonly kind: 'page';
      readonly query: string;
      readonly store: string;
      /** Display only. */
      readonly page: number | null;
      readonly storeParams: string;
      readonly results: SearchResults;
    };

/** The page state the search page renders. */
export type SearchPageView = Extract<SearchPageDecision, { kind: 'page' }>;

export interface SearchPageRequest {
  /** Request query string, without the leading `?`. */
  readonly search: string;
  readonly userAgent: string | null;
}

export interface SearchPageDeps {
  isBot(userAgent: string | null): boolean;
  searchStore(
    store: string,
    query: string,
    filters: string,
    pageSize: number,
  ): Promise<StoreSearchOutcome>;
  /** Store config `grid_per_page`; may reject. */
  gridPerPage(): Promise<number>;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
}

/**
 * Decides the search page before anything streams: the unknown-store
 * redirect, bots and blank queries (no backend call), then the CHAPI search.
 * There is no Magento search term redirect: the legacy PWA stopped asking
 * for it (CHUP-569), so searches go straight to CHAPI. A failed search is a page state, never a 5xx.
 */
export async function resolveSearchPage(
  { search, userAgent }: SearchPageRequest,
  deps: SearchPageDeps,
): Promise<SearchPageDecision> {
  const decision = await decide(search, userAgent, deps);
  deps.metrics.emitMetric({
    name: 'SearchPage',
    value: 1,
    dimensions: { Outcome: outcomeOf(decision) },
  });
  return decision;
}

async function decide(
  search: string,
  userAgent: string | null,
  deps: SearchPageDeps,
): Promise<SearchPageDecision> {
  const parsed = parseSearchRequest(new URLSearchParams(search));
  if (parsed.kind === 'redirect') {
    return { kind: 'redirect', reason: 'unknown_store', location: parsed.location };
  }
  const { request } = parsed;
  const page = (results: SearchResults): SearchPageDecision => ({
    kind: 'page',
    ...request,
    results,
  });

  if (request.query === '') return page({ kind: 'none', reason: 'empty_query' });
  if (deps.isBot(userAgent)) return page({ kind: 'none', reason: 'bot' });

  if (request.store === CHUPACHOICE_STORE) {
    const listings = await Promise.all(
      CHUPACHOICE_LISTS.map(({ store, pageSize }) =>
        listStore(deps, store, request.query, '', pageSize),
      ),
    );
    return page({ kind: 'multi', listings });
  }

  const pageSize = await gridPerPage(deps);
  const listing = await listStore(
    deps,
    request.store,
    request.query,
    request.storeParams,
    pageSize,
  );
  return page({ kind: 'single', listing });
}

async function gridPerPage(deps: SearchPageDeps): Promise<number> {
  try {
    const value = await deps.gridPerPage();
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_SEARCH_PAGE_SIZE;
  } catch {
    // The search itself reports the store config failure.
    return DEFAULT_SEARCH_PAGE_SIZE;
  }
}

async function listStore(
  deps: SearchPageDeps,
  store: string,
  query: string,
  filters: string,
  pageSize: number,
): Promise<StoreListing> {
  const listing = { store, pageSize, filters };
  let outcome: StoreSearchOutcome;
  try {
    outcome = await deps.searchStore(store, query, filters, pageSize);
  } catch (error) {
    // Decision 10: a search failure is a 200 error state, never a 5xx, even if a dependency throws.
    deps.logger.error({ store, err: error }, 'search store failed unexpectedly');
    return { ...listing, result: null, failure: 'error', servedByFallback: false };
  }
  switch (outcome.status) {
    case 'ok':
      return {
        ...listing,
        result: outcome.result,
        failure: null,
        servedByFallback: outcome.servedByFallback,
      };
    case 'unsupported_store':
      // A tab store without CHAPI routing is a store config problem, shown as an error.
      deps.logger.error({ store }, 'search store has no CHAPI routing in the store config');
      return { ...listing, result: null, failure: 'error', servedByFallback: false };
    default:
      return { ...listing, result: null, failure: outcome.status, servedByFallback: false };
  }
}

function outcomeOf(decision: SearchPageDecision): string {
  if (decision.kind === 'redirect') return `redirect_${decision.reason}`;
  const { results } = decision;
  if (results.kind === 'none') return results.reason;
  const listings = results.kind === 'single' ? [results.listing] : results.listings;
  return listings.some((listing) => listing.failure !== null) ? 'failure' : 'results';
}
