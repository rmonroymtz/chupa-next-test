import 'server-only';
import { cache } from 'react';
import {
  createStoreSearch,
  type StoreSearch,
  type StoreSearchOutcome,
} from '@/modules/search/application/store-search';
import type { SearchResult, SearchSortOption } from '@/modules/search/domain/search-result';
import { getChapiSearchGateway } from '@/modules/search/infrastructure/chapi-search-gateway';
import { getStoreConfig } from '@/modules/store-config/infrastructure/magento-store-config-repository';
import { defaultObservability } from '@/shared/http/observability';

/** Composition root for search: CHAPI gateway + per-request store config. */

let storeSearch: StoreSearch | undefined;

function getStoreSearch(): StoreSearch {
  storeSearch ??= createStoreSearch({
    gateway: getChapiSearchGateway(),
    // Per-request cached read; a failure becomes an `error` outcome.
    storeConfig: { get: getStoreConfig },
    ...defaultObservability('search'),
  });
  return storeSearch;
}

/**
 * One store's CHAPI search for the current request. React `cache()`
 * deduplicates identical calls (e.g. `generateMetadata` and the page) within
 * one request only; nothing is shared across requests.
 */
export const searchStore = cache(
  (store: string, query: string, filters: string, pageSize: number): Promise<StoreSearchOutcome> =>
    getStoreSearch().search({ store, query, filters, pageSize }),
);

/**
 * Sort options for a result of {@link searchStore} with the same arguments:
 * the response's own sorts, else one `sort_by` call. Never rejects.
 */
export const getSearchSortOptions = cache(
  (
    store: string,
    query: string,
    filters: string,
    pageSize: number,
    result: SearchResult,
  ): Promise<readonly SearchSortOption[]> =>
    getStoreSearch().sortOptions({ store, query, filters, pageSize }, result),
);
