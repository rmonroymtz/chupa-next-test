import { describe, expect, it } from 'vitest';
import {
  addToCartInputSchema,
  cartReadInputSchema,
  removeCartItemInputSchema,
} from '@/modules/cart/application/cart-input';

const valid = {
  cartId: 'aBcD1234aBcD1234aBcD1234aBcD1234',
  signinToken: 'eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjF9.sig-_',
  item: { sku: 'B0ASIN0001', quantity: 2, vendor: 'amazon' },
};

describe('addToCartInputSchema', () => {
  it('accepts guest and signed-in payloads, with or without a cart', () => {
    expect(addToCartInputSchema.safeParse(valid).success).toBe(true);
    expect(
      addToCartInputSchema.safeParse({ ...valid, cartId: null, signinToken: null }).success,
    ).toBe(true);
    expect(
      addToCartInputSchema.safeParse({
        ...valid,
        item: { ...valid.item, sku: '126981644035|428130345038', selected_options: ['Y29uZmln'] },
      }).success,
    ).toBe(true);
  });

  it.each([
    ['non-integer quantity', { ...valid, item: { ...valid.item, quantity: 1.5 } }],
    ['zero quantity', { ...valid, item: { ...valid.item, quantity: 0 } }],
    ['empty sku', { ...valid, item: { ...valid.item, sku: ' ' } }],
    ['cart id with quotes', { ...valid, cartId: 'abc"}' }],
    ['token with spaces', { ...valid, signinToken: 'Bearer abc' }],
    ['empty selected options', { ...valid, item: { ...valid.item, selected_options: [] } }],
    ['missing item', { cartId: null, signinToken: null }],
  ])('rejects %s', (_label, input) => {
    expect(addToCartInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('cartReadInputSchema', () => {
  it('requires a cart id', () => {
    expect(cartReadInputSchema.safeParse({ cartId: 'abc', signinToken: null }).success).toBe(true);
    expect(cartReadInputSchema.safeParse({ cartId: null, signinToken: null }).success).toBe(false);
  });
});

describe('removeCartItemInputSchema', () => {
  const valid = { cartId: 'abc', signinToken: null, itemUid: 'MTIzNDU=' };

  it('accepts a cart id and a Magento cart item uid (base64)', () => {
    expect(removeCartItemInputSchema.safeParse(valid).success).toBe(true);
    expect(
      removeCartItemInputSchema.safeParse({ ...valid, signinToken: 'a.b.c', itemUid: 'NQ' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['a missing cart id', { ...valid, cartId: null }],
    ['an empty uid', { ...valid, itemUid: '' }],
    ['a uid with markup', { ...valid, itemUid: '<script>' }],
    ['an oversized uid', { ...valid, itemUid: 'A'.repeat(257) }],
    ['a numeric uid', { ...valid, itemUid: 12345 }],
  ])('rejects %s', (_label, input) => {
    expect(removeCartItemInputSchema.safeParse(input).success).toBe(false);
  });
});
