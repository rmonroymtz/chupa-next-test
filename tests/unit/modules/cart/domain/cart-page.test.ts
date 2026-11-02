import { describe, expect, it } from 'vitest';
import type { CartDetailsItem, CartSummary } from '@/modules/cart/application/ports';
import {
  cartHeading,
  displayedSubtotal,
  expiredBannerText,
  expiredQuoteItems,
  priceChangedItems,
  renewalMessage,
  unavailableItems,
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
    rowTotal: null,
    quoteExpiresAt: null,
    quotePriceExpired: false,
    priceChange: null,
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

const change = (overrides: Partial<NonNullable<CartDetailsItem['priceChange']>> = {}) => ({
  changed: false,
  previousPrice: null,
  currentPrice: null,
  delta: null,
  outOfStock: false,
  ...overrides,
});

describe('partitionCartItems with price-change availability', () => {
  it('hides regular items the backend flags out of stock (they show in the notice only)', () => {
    const items = [item('a'), item('gone', { priceChange: change({ outOfStock: true }) })];
    expect(partitionCartItems(items).regular.map((entry) => entry.uid)).toEqual(['a']);
  });

  it('keeps quote items even when flagged', () => {
    const items = [item('q', { isFromQuote: true, priceChange: change({ outOfStock: true }) })];
    expect(partitionCartItems(items).quotes.map((entry) => entry.uid)).toEqual(['q']);
  });
});

describe('expiredQuoteItems', () => {
  it('lists quote items whose price expired', () => {
    const items = [
      item('a', { quotePriceExpired: true }),
      item('q1', { isFromQuote: true, quotePriceExpired: true }),
      item('q2', { isFromQuote: true }),
    ];
    expect(expiredQuoteItems(items).map((entry) => entry.uid)).toEqual(['q1']);
  });
});

describe('priceChangedItems', () => {
  it('lists regular items whose price changed and has a previous price', () => {
    const items = [
      item('up', {
        priceChange: change({ changed: true, previousPrice: 100, currentPrice: 120, delta: 20 }),
      }),
      item('noprev', { priceChange: change({ changed: true, currentPrice: 120, delta: 20 }) }),
      item('same', { priceChange: change() }),
      item('quote', {
        isFromQuote: true,
        priceChange: change({ changed: true, previousPrice: 1, currentPrice: 2, delta: 1 }),
      }),
    ];
    expect(priceChangedItems(items).map((entry) => entry.uid)).toEqual(['up']);
  });
});

describe('unavailableItems', () => {
  it('joins regular items flagged by the backend and quote items out of stock, in cart order', () => {
    const items = [
      item('gone', { priceChange: change({ outOfStock: true }) }),
      item('ok'),
      item('q', { isFromQuote: true, outOfStock: true }),
      item('qok', { isFromQuote: true }),
    ];
    expect(unavailableItems(items).map((entry) => entry.uid)).toEqual(['gone', 'q']);
  });
});

describe('displayedSubtotal', () => {
  it('subtracts the row totals of the hidden out-of-stock items, never below zero', () => {
    const items = [
      item('gone', { rowTotal: mxn(300), priceChange: change({ outOfStock: true }) }),
      item('ok', { rowTotal: mxn(700) }),
    ];
    expect(displayedSubtotal(summary({ subtotal: mxn(1000) }), items)).toEqual(mxn(700));
    expect(displayedSubtotal(summary({ subtotal: mxn(200) }), items)).toEqual(mxn(0));
  });

  it('is the subtotal untouched when nothing is hidden, and null without a subtotal', () => {
    expect(displayedSubtotal(summary({ subtotal: mxn(1000) }), [item('ok')])).toEqual(mxn(1000));
    expect(displayedSubtotal(summary({ subtotal: null }), [item('ok')])).toBeNull();
  });
});

describe('expiredBannerText', () => {
  it('uses the singular for one product and the plural otherwise', () => {
    expect(expiredBannerText(1)).toBe('Tienes 1 producto con precio de cotización expirado.');
    expect(expiredBannerText(3)).toBe('Tienes 3 productos con precios de cotización expirados.');
  });
});

describe('renewalMessage', () => {
  const renewed = (name: string, previousPrice: number | null, newPrice: number | null) => ({
    itemUid: name,
    sku: name,
    name,
    previousPrice,
    newPrice,
  });

  it('names the product and both prices for one renewal', () => {
    expect(renewalMessage([renewed('Lámpara', 250, 300)], 'MXN')).toBe(
      'Precio actualizado: Lámpara ($250.00 → $300.00)',
    );
  });

  it('counts several renewals and explains when there were none', () => {
    expect(renewalMessage([renewed('a', 1, 2), renewed('b', 1, 2)], 'MXN')).toBe(
      '2 precios de cotización actualizados.',
    );
    expect(renewalMessage([], 'MXN')).toBe('No se encontraron precios por actualizar.');
  });

  it('falls back to the name only when a price is unknown', () => {
    expect(renewalMessage([renewed('Lámpara', null, 300)], 'MXN')).toBe(
      'Precio actualizado: Lámpara',
    );
  });
});
