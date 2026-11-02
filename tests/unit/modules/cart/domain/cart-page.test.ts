import { describe, expect, it } from 'vitest';
import type { CartDetailsItem, CartSummary } from '@/modules/cart/application/ports';
import {
  cartHeading,
  discountTotal,
  hasOutOfStockItem,
  orderTotal,
  partitionCartItems,
  shippingLine,
} from '@/modules/cart/domain/cart-page';

function item(uid: string, overrides: Partial<CartDetailsItem> = {}): CartDetailsItem {
  return {
    uid,
    name: uid,
    sku: uid,
    url: `/${uid}.html`,
    imageUrl: null,
    quantity: 1,
    unitPrice: null,
    options: [],
    outOfStock: false,
    isFromQuote: false,
    ...overrides,
  };
}

describe('cartHeading', () => {
  it('is "Mi carrito" without quote items', () => {
    expect(cartHeading([item('a'), item('b')])).toBe('Mi carrito');
  });

  it('adds the quote suffix when any item comes from a quote', () => {
    expect(cartHeading([item('a'), item('b', { isFromQuote: true })])).toBe(
      'Mi carrito + cotización',
    );
  });
});

describe('partitionCartItems', () => {
  it('splits regular and quote items, keeping the cart order in each group', () => {
    const items = [
      item('a'),
      item('q1', { isFromQuote: true }),
      item('b'),
      item('q2', { isFromQuote: true }),
    ];
    const { regular, quotes } = partitionCartItems(items);
    expect(regular.map((entry) => entry.uid)).toEqual(['a', 'b']);
    expect(quotes.map((entry) => entry.uid)).toEqual(['q1', 'q2']);
  });
});

describe('hasOutOfStockItem', () => {
  it('is true when any item is out of stock', () => {
    expect(hasOutOfStockItem([item('a'), item('b', { outOfStock: true })])).toBe(true);
    expect(hasOutOfStockItem([item('a')])).toBe(false);
    expect(hasOutOfStockItem([])).toBe(false);
  });
});

const mxn = (amount: number) => ({ amount, currency: 'MXN' });

function summary(overrides: Partial<CartSummary> = {}): CartSummary {
  return {
    subtotal: mxn(1000),
    discounts: [],
    taxes: [],
    selectedShipping: null,
    shippingEstimate: null,
    grandTotal: mxn(1000),
    freeShippingThreshold: null,
    ...overrides,
  };
}

describe('shippingLine', () => {
  it('prefers the selected shipping method over the estimate', () => {
    expect(
      shippingLine(summary({ selectedShipping: mxn(99), shippingEstimate: mxn(150) })),
    ).toEqual(mxn(99));
  });

  it('falls back to the estimate and is null when neither is known', () => {
    expect(shippingLine(summary({ shippingEstimate: mxn(150) }))).toEqual(mxn(150));
    expect(shippingLine(summary())).toBeNull();
  });

  it('keeps a zero amount (the page shows it as free)', () => {
    expect(shippingLine(summary({ shippingEstimate: mxn(0) }))).toEqual(mxn(0));
  });
});

describe('orderTotal', () => {
  it('adds the estimate to the grand total only when no shipping method is selected', () => {
    expect(orderTotal(summary({ shippingEstimate: mxn(150) }))).toEqual(mxn(1150));
    expect(orderTotal(summary({ selectedShipping: mxn(99), shippingEstimate: mxn(150) }))).toEqual(
      mxn(1000),
    );
    expect(orderTotal(summary())).toEqual(mxn(1000));
  });

  it('is null without a grand total', () => {
    expect(orderTotal(summary({ grandTotal: null, shippingEstimate: mxn(150) }))).toBeNull();
  });
});

describe('discountTotal', () => {
  it('sums the discounts and is null when there are none or they add up to zero', () => {
    const discounts = [
      { label: 'Cupón', amount: mxn(50) },
      { label: 'Promo', amount: mxn(25.5) },
    ];
    expect(discountTotal(summary({ discounts }))).toEqual(mxn(75.5));
    expect(discountTotal(summary())).toBeNull();
    expect(discountTotal(summary({ discounts: [{ label: 'x', amount: mxn(0) }] }))).toBeNull();
  });
});
