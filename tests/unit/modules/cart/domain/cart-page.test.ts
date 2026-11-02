import { describe, expect, it } from 'vitest';
import type { CartDetailsItem } from '@/modules/cart/application/ports';
import {
  cartHeading,
  hasOutOfStockItem,
  partitionCartItems,
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
