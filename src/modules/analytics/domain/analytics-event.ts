/**
 * Vendor-neutral analytics events. Components dispatch these domain events;
 * each provider (GTM today) maps them to its own format, as the legacy PWA
 * eventing context did (`@chupaprecios/google-tag-manager` handlers).
 */

/** A price with its ISO 4217 currency. */
export interface AnalyticsMoney {
  readonly amount: number;
  readonly currency: string;
}

/** The shopper added a product to the cart (legacy `CART_ADD_ITEM`). */
export interface ProductAddedToCart {
  readonly type: 'ProductAddedToCart';
  readonly sku: string;
  readonly name: string;
  readonly unitPrice: AnalyticsMoney;
  readonly quantity: number;
}

/** A search was requested for a store (legacy `SEARCH_REQUEST`). */
export interface SearchRequested {
  readonly type: 'SearchRequested';
  readonly query: string;
  readonly store: string;
}

/** One product of a search result list. */
export interface SearchResultItem {
  readonly sku: string;
  readonly name: string;
  readonly price: number | null;
  readonly brand: string | null;
  /** 1-based position in the list. */
  readonly index: number;
}

/** The shopper saw a list of search results (legacy `SEARCH_RESPONSE`). */
export interface SearchResultsViewed {
  readonly type: 'SearchResultsViewed';
  readonly query: string;
  readonly store: string;
  readonly items: readonly SearchResultItem[];
}

export type AnalyticsEvent = ProductAddedToCart | SearchRequested | SearchResultsViewed;
