import { describe, expect, it } from 'vitest';
import type {
  ProductAddedToCart,
  SearchResultsViewed,
} from '@/modules/analytics/domain/analytics-event';
import { toDataLayerObject } from '@/modules/analytics/infrastructure/gtm/gtm-mappers';

const addedToCart = (overrides: Partial<ProductAddedToCart> = {}): ProductAddedToCart => ({
  type: 'ProductAddedToCart',
  sku: 'B0TESTSKU1',
  name: 'Audífonos inalámbricos',
  unitPrice: { amount: 1299.5, currency: 'MXN' },
  quantity: 2,
  ...overrides,
});

const resultsViewed = (items: SearchResultsViewed['items']): SearchResultsViewed => ({
  type: 'SearchResultsViewed',
  query: 'taladro',
  store: 'amazon',
  items,
});

describe('toDataLayerObject: ProductAddedToCart (legacy GTM add_to_cart)', () => {
  it('builds the GA4 add_to_cart payload the legacy handler pushes', () => {
    expect(toDataLayerObject(addedToCart())).toEqual({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'MXN',
        value: 2599,
        items: [
          {
            item_id: 'B0TESTSKU1',
            item_name: 'Audífonos inalámbricos',
            price: 1299.5,
            quantity: 2,
          },
        ],
      },
    });
  });

  it('omits the item price when the unit price is zero', () => {
    const payload = toDataLayerObject(addedToCart({ unitPrice: { amount: 0, currency: 'MXN' } }));

    expect(payload).toEqual({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'MXN',
        value: 0,
        items: [{ item_id: 'B0TESTSKU1', item_name: 'Audífonos inalámbricos', quantity: 2 }],
      },
    });
  });
});

describe('toDataLayerObject: SearchRequested (legacy searchRequestSent)', () => {
  it('pushes the GA4 search event with the term and the store', () => {
    expect(
      toDataLayerObject({ type: 'SearchRequested', query: 'taladro', store: 'amazon' }),
    ).toEqual({ event: 'search', search_term: 'taladro', store: 'amazon' });
  });
});

describe('toDataLayerObject: SearchResultsViewed (legacy searchResponseReceived)', () => {
  it('pushes view_item_list with the real price and brand', () => {
    const payload = toDataLayerObject(
      resultsViewed([
        { sku: 'B0A', name: 'Taladro DeWalt', price: 4434.6, brand: 'DEWALT', index: 1 },
        { sku: 'B0B', name: 'Taladro genérico', price: null, brand: null, index: 2 },
      ]),
    );

    expect(payload).toEqual({
      event: 'view_item_list',
      ecommerce: {
        item_list_name: 'Search Results',
        item_list_id: 'search_results',
        items: [
          {
            item_id: 'B0A',
            item_name: 'Taladro DeWalt',
            price: 4434.6,
            item_brand: 'DEWALT',
            index: 1,
          },
          { item_id: 'B0B', item_name: 'Taladro genérico', price: 0, item_brand: '', index: 2 },
        ],
      },
    });
  });

  it('pushes nothing for an empty result list', () => {
    expect(toDataLayerObject(resultsViewed([]))).toBeNull();
  });
});
