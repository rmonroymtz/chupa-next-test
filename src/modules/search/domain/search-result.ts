/**
 * Search result view models built from the scraper API (CHAPI) search
 * endpoint. Pure domain types: no framework imports and no I/O.
 *
 * CHAPI links (pagination, refinements, sorts) are opaque strings: they are
 * sent back to CHAPI unchanged as the search `filters` (the legacy
 * `storeParams` query parameter) and never parsed by the storefront.
 */
import type { ProductCard } from '@/modules/product/domain/product';

/** One product of a result page; renders with the same card as CMS product lists. */
export interface SearchItem extends ProductCard {
  readonly brand: string | null;
  /** Vendor review rating (0–5) as returned; null when absent or zero. */
  readonly rating: number | null;
}

/** Opaque CHAPI link with its label (a page number for pagination). */
export interface SearchLink {
  readonly title: string;
  readonly link: string;
}

export interface SearchPagination {
  /** Current page number as reported by CHAPI (1-based). */
  readonly current: number;
  /** Null when CHAPI does not report it (staging never does). */
  readonly totalPages: number | null;
  readonly next: string | null;
  readonly prev: string | null;
  /** Links to other pages, labeled with their page number. */
  readonly links: readonly SearchLink[];
}

export interface SearchRefinementOption {
  readonly title: string;
  /** Opaque link; for a checked option it is the link that removes it. */
  readonly link: string;
  readonly checked: boolean;
}

export interface SearchRefinement {
  readonly title: string;
  /** CHAPI control type, e.g. `checkbox` or `text`. */
  readonly type: string;
  readonly options: readonly SearchRefinementOption[];
}

export interface SearchSortOption {
  readonly title: string;
  readonly link: string;
  readonly selected: boolean;
}

export interface SearchResult {
  /**
   * Store that answered (`data.vendor`). It differs from the requested store
   * when CHAPI served the search from another store (fallback notice).
   */
  readonly vendor: string;
  readonly items: readonly SearchItem[];
  /**
   * `data.totalProducts` as returned. Amazon reports the item count of the
   * page, eBay the total of the whole search.
   */
  readonly totalCount: number;
  readonly pagination: SearchPagination;
  readonly refinements: readonly SearchRefinement[];
  /** Empty when the response carries none (see the sort options use case). */
  readonly sorts: readonly SearchSortOption[];
  /** Unusable items dropped by the mapper (no SKU, no title or no positive price). */
  readonly skippedItems: number;
  /** Items dropped because their SKU was already listed (the first one is kept). */
  readonly duplicateItems: number;
}
