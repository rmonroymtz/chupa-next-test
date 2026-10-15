import type { Logger } from 'pino';
import type { SearchGateway } from '@/modules/search/application/ports';
import type { SearchResult, SearchSortOption } from '@/modules/search/domain/search-result';
import type { StoreConfigRepository } from '@/modules/store-config/application/ports';
import { resolveSearchEngineId } from '@/modules/store-config/domain/store-config';

/** `max_results` the legacy sort selector always sends to `sort_by`. */
export const SORT_MAX_RESULTS = 16;

export interface StoreSearchInput {
  /** Store requested by the shopper (`store` query parameter). */
  readonly store: string;
  readonly query: string;
  /** Opaque CHAPI link (`storeParams`) or `''`. */
  readonly filters: string;
  readonly pageSize: number;
}

export type StoreSearchOutcome =
  | {
      readonly status: 'ok';
      readonly requestedStore: string;
      readonly result: SearchResult;
      /** True when CHAPI answered from another store (`data.vendor`). */
      readonly servedByFallback: boolean;
    }
  /** No `service_fallback` or no search engine for the store; CHAPI not called. */
  | { readonly status: 'unsupported_store'; readonly requestedStore: string }
  | { readonly status: 'timeout' | 'error' | 'invalid'; readonly requestedStore: string };

export interface StoreSearch {
  search(input: StoreSearchInput): Promise<StoreSearchOutcome>;
  /**
   * Sort options for a result page. The search response's own `sorts` win;
   * only when it has none is `sort_by` called (legacy `useGetSortFilters`).
   * It needs the search response first, so callers can stream it separately
   * instead of delaying the results. Never rejects: a failure means no sort
   * options.
   */
  sortOptions(input: StoreSearchInput, result: SearchResult): Promise<readonly SearchSortOption[]>;
}

export interface StoreSearchDeps {
  readonly gateway: SearchGateway;
  readonly storeConfig: StoreConfigRepository;
  readonly logger: Logger;
}

interface ChapiRoute {
  readonly chapiStore: string;
  readonly engineId: string;
}

/**
 * Searches one store through CHAPI, routing it like the legacy storefront:
 * `store = service_fallback[store]`,
 * `engine_id = engine_settings[service_fallback[store] + '_search_engine']`.
 */
export function createStoreSearch(deps: StoreSearchDeps): StoreSearch {
  /** Null when the store cannot be searched; rejects when the store config fails. */
  async function route(store: string): Promise<ChapiRoute | null> {
    const { engineRouting } = await deps.storeConfig.get();
    const engineId = resolveSearchEngineId(store, engineRouting);
    const chapiStore = engineRouting.serviceFallback[store]?.trim().toLowerCase();
    return engineId && chapiStore ? { chapiStore, engineId } : null;
  }

  async function safeRoute(store: string): Promise<ChapiRoute | null | 'failed'> {
    try {
      return await route(store);
    } catch (error) {
      deps.logger.warn({ err: error, store }, 'search store config unavailable');
      return 'failed';
    }
  }

  return {
    async search(input) {
      const requestedStore = normalizeStore(input.store);
      const resolved = await safeRoute(requestedStore);
      if (resolved === 'failed') return { status: 'error', requestedStore };
      if (!resolved) return { status: 'unsupported_store', requestedStore };

      const response = await deps.gateway.search({
        query: input.query,
        store: resolved.chapiStore,
        engineId: resolved.engineId,
        filters: input.filters,
        pageSize: input.pageSize,
      });
      if (response.status !== 'ok') return { status: response.status, requestedStore };
      return {
        status: 'ok',
        requestedStore,
        result: response.data,
        servedByFallback: response.data.vendor !== requestedStore,
      };
    },

    async sortOptions(input, result) {
      if (result.sorts.length > 0) return result.sorts;
      const resolved = await safeRoute(normalizeStore(input.store));
      if (resolved === 'failed' || !resolved) return [];

      const response = await deps.gateway.sortOptions({
        query: input.query,
        store: resolved.chapiStore,
        engineId: resolved.engineId,
        filters: input.filters,
        maxResults: SORT_MAX_RESULTS,
      });
      return response.status === 'ok' ? response.data : [];
    },
  };
}

function normalizeStore(store: string): string {
  return store.trim().toLowerCase();
}
