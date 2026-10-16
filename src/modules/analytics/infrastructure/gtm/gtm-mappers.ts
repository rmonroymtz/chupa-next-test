import type {
  AnalyticsEvent,
  ProductAddedToCart,
  SearchRequested,
  SearchResultsViewed,
} from '@/modules/analytics/domain/analytics-event';
import type { DataLayerObject } from '@/modules/analytics/infrastructure/gtm/data-layer';

/** Maps a domain event to its GTM dataLayer message; null when nothing is pushed. */
export function toDataLayerObject(event: AnalyticsEvent): DataLayerObject | null {
  switch (event.type) {
    case 'ProductAddedToCart':
      return addToCart(event);
    case 'SearchRequested':
      return search(event);
    case 'SearchResultsViewed':
      return viewItemList(event);
  }
}

/** GA4 `add_to_cart`, as the legacy handler pushes it (`handlers/addToCart.js`). */
function addToCart(event: ProductAddedToCart): DataLayerObject {
  const { unitPrice, quantity } = event;
  return {
    event: 'add_to_cart',
    ecommerce: {
      currency: unitPrice.currency,
      value: unitPrice.amount * quantity,
      items: [
        {
          item_id: event.sku,
          item_name: event.name,
          ...(unitPrice.amount ? { price: unitPrice.amount } : {}),
          quantity: quantity || 1,
        },
      ],
    },
  };
}

/** GA4 `search` (legacy `handlers/searchRequestSent.js`). */
function search(event: SearchRequested): DataLayerObject {
  return { event: 'search', search_term: event.query, store: event.store };
}

/**
 * GA4 `view_item_list` (legacy `handlers/searchResponseReceived.js`); nothing
 * for an empty list. The legacy handler sent `price: NaN` and an empty brand
 * (bug); the real values are sent here.
 */
function viewItemList(event: SearchResultsViewed): DataLayerObject | null {
  if (event.items.length === 0) return null;
  return {
    event: 'view_item_list',
    ecommerce: {
      item_list_name: 'Search Results',
      item_list_id: 'search_results',
      items: event.items.map((item) => ({
        item_id: item.sku,
        item_name: item.name,
        price: item.price ?? 0,
        item_brand: item.brand ?? '',
        index: item.index,
      })),
    },
  };
}
