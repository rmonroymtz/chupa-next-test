import type { SearchResult, SearchSortOption } from '@/modules/search/domain/search-result';

/** Body of `POST /api/v1/search/`, in storefront terms. */
export interface ChapiSearchQuery {
  readonly query: string;
  /** CHAPI store: the `service_fallback` value of the requested store. */
  readonly store: string;
  readonly engineId: string;
  /** Opaque CHAPI link (`storeParams`) or `''` for the first page. */
  readonly filters: string;
  readonly pageSize: number;
}

/** Body of `POST /api/v1/search/sort_by`. */
export interface ChapiSortQuery {
  readonly query: string;
  readonly store: string;
  readonly engineId: string;
  readonly filters: string;
  readonly maxResults: number;
}

/**
 * Outcome of one CHAPI search call. The gateway never rejects:
 * `timeout` when the call exceeded its budget, `error` for network or
 * non-2xx failures, `invalid` when the body is not the expected shape.
 */
export type ChapiSearchResult<T> =
  | { readonly status: 'ok'; readonly data: T }
  | { readonly status: 'timeout' }
  | { readonly status: 'error' }
  | { readonly status: 'invalid' };

export interface SearchGateway {
  search(query: ChapiSearchQuery): Promise<ChapiSearchResult<SearchResult>>;
  sortOptions(query: ChapiSortQuery): Promise<ChapiSearchResult<readonly SearchSortOption[]>>;
}
