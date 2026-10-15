/**
 * The search page request (`/search.html?query&store&page&storeParams`, the
 * legacy url model) and the redirects it may answer. Pure domain code.
 */
import { DEFAULT_SEARCH_STORE, SEARCH_PATH, SEARCH_STORES } from '@/modules/layout/domain/search';

/** Multi-store view: one short list per CHAPI store. */
export const CHUPACHOICE_STORE = DEFAULT_SEARCH_STORE;

/** ChupaChoice lists and page sizes, in the legacy order (`chupaChoice.js`). */
export const CHUPACHOICE_LISTS: readonly { readonly store: string; readonly pageSize: number }[] = [
  { store: 'amazon', pageSize: 12 },
  { store: 'ebay', pageSize: 6 },
  { store: 'target', pageSize: 6 },
  { store: 'acme', pageSize: 6 },
];

/** Stores the page serves: the search bar tabs (ChupaChoice plus the CHAPI stores). */
const KNOWN_STORES: ReadonlySet<string> = new Set(SEARCH_STORES.map((store) => store.id));

const POSITIVE_INTEGER = /^[1-9]\d{0,8}$/;

export interface SearchRequest {
  /** Trimmed; `''` when missing or blank. */
  readonly query: string;
  /** A known store id, lower case. */
  readonly store: string;
  /** Display only (never sent to CHAPI); null unless a positive integer. */
  readonly page: number | null;
  /** Opaque CHAPI link sent as the search `filters`; `''` when missing. */
  readonly storeParams: string;
}

export type ParsedSearchRequest =
  | { readonly kind: 'request'; readonly request: SearchRequest }
  /** Unknown or non-CHAPI store (e.g. homedepot, walmart): same search on ChupaChoice. */
  | { readonly kind: 'redirect'; readonly location: string };

/**
 * Reads the search query string. A missing or blank `store` is ChupaChoice;
 * any other unknown value redirects to the same url with
 * `store=chupachoice`, keeping every other parameter except `storeParams`
 * (a CHAPI link of the other store).
 */
export function parseSearchRequest(params: URLSearchParams): ParsedSearchRequest {
  const rawStore = (params.get('store') ?? '').trim().toLowerCase();
  const store = rawStore === '' ? CHUPACHOICE_STORE : rawStore;
  if (!KNOWN_STORES.has(store)) {
    const next = new URLSearchParams(params);
    next.set('store', CHUPACHOICE_STORE);
    next.delete('storeParams');
    return { kind: 'redirect', location: `${SEARCH_PATH}?${next.toString()}` };
  }
  const page = (params.get('page') ?? '').trim();
  return {
    kind: 'request',
    request: {
      query: (params.get('query') ?? '').trim(),
      store,
      page: POSITIVE_INTEGER.test(page) ? Number(page) : null,
      storeParams: params.get('storeParams') ?? '',
    },
  };
}
