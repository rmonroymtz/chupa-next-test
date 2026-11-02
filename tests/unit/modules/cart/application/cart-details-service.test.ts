import { describe, expect, it } from 'vitest';
import {
  CartGatewayError,
  type CartAuth,
  type CartDetails,
  type CartSummary,
  type CartGateway,
} from '@/modules/cart/application/ports';
import { createCartService } from '@/modules/cart/application/cart-service';
import {
  cartDetailsReadInputSchema,
  removeCartDetailsItemInputSchema,
  updateCartItemInputSchema,
} from '@/modules/cart/application/cart-input';
import { createCapturingObservability } from '../../../../support/observability';

const TOKEN = 'secret.jwt.token';
const SUMMARY: CartSummary = {
  subtotal: null,
  discounts: [],
  taxes: [],
  selectedShipping: null,
  shippingEstimate: null,
  grandTotal: null,
  freeShippingThreshold: null,
};
const DETAILS: CartDetails = { totalQuantity: 2, items: [], summary: SUMMARY };
const RENEWED = [
  { itemUid: 'MTIz', sku: 'B0LAMP', name: 'Lámpara', previousPrice: 250, newPrice: 300 },
];
const EXTRAS = { shippingEstimate: { amount: 149, currency: 'MXN' }, freeShippingThreshold: 999 };
/** What the service answers: the cart with the extras merged into its summary. */
const WITH_EXTRAS: CartDetails = { ...DETAILS, summary: { ...SUMMARY, ...EXTRAS } };

type Step = 'invalid' | 'failure' | 'ok';

/** Gateway that only knows the cart page operations; the rest is never called. */
class DetailsGateway {
  readonly calls: { op: string; cartId: string; token: string | null }[] = [];
  constructor(
    private readonly step: Step,
    private readonly extrasFail = false,
  ) {}

  async getCartExtras(cartId: string, auth: CartAuth) {
    this.calls.push({ op: 'extras', cartId, token: auth.signinToken });
    if (this.extrasFail) throw new CartGatewayError('failure', 'extras down');
    return EXTRAS;
  }

  private async answer(op: string, cartId: string, auth: CartAuth): Promise<CartDetails> {
    this.calls.push({ op, cartId, token: auth.signinToken });
    if (this.step === 'invalid')
      throw new CartGatewayError('invalid_cart', 'Could not find a cart with ID "x"');
    if (this.step === 'failure') throw new CartGatewayError('failure', 'Magento down');
    return DETAILS;
  }

  getCartDetails(cartId: string, auth: CartAuth) {
    return this.answer('details', cartId, auth);
  }
  updateCartItemQuantity(cartId: string, itemUid: string, quantity: number, auth: CartAuth) {
    return this.answer(`update:${itemUid}:${quantity}`, cartId, auth);
  }
  removeCartDetailsItem(cartId: string, itemUid: string, auth: CartAuth) {
    return this.answer(`remove:${itemUid}`, cartId, auth);
  }
  async refreshExpiredQuotePrices(cartId: string, auth: CartAuth) {
    await this.answer('refresh', cartId, auth);
    return RENEWED;
  }
  async acknowledgeCartPriceChanges(cartId: string, auth: CartAuth) {
    await this.answer('acknowledge', cartId, auth);
  }
}

function setup(step: Step, extrasFail = false) {
  const gateway = new DetailsGateway(step, extrasFail);
  const observability = createCapturingObservability();
  const service = createCartService({
    gateway: gateway as unknown as CartGateway,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway, service, ...observability };
}

describe('cartService quote and price-change operations', () => {
  it('refreshes expired quote prices, answers the renewed items and the cart read again', async () => {
    const { gateway, service, metricsNamed } = setup('ok');
    // The gateway answers the same cart for the read that follows the refresh.
    expect(await service.refreshExpiredQuotePrices({ cartId: 'c', signinToken: TOKEN })).toEqual({
      status: 'ok',
      cart: WITH_EXTRAS,
      renewed: RENEWED,
    });
    expect(gateway.calls).toEqual([
      { op: 'refresh', cartId: 'c', token: TOKEN },
      { op: 'details', cartId: 'c', token: TOKEN },
      { op: 'extras', cartId: 'c', token: TOKEN },
    ]);
    expect(metricsNamed('CartRefreshQuotePrices')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'success' } }),
    ]);
  });

  it('acknowledges the price changes and answers the cart read again', async () => {
    const { gateway, service, metricsNamed } = setup('ok');
    expect(await service.acknowledgePriceChanges({ cartId: 'c', signinToken: null })).toEqual({
      status: 'ok',
      cart: WITH_EXTRAS,
    });
    expect(gateway.calls.map((call) => call.op)).toEqual(['acknowledge', 'details', 'extras']);
    expect(metricsNamed('CartAcknowledgePriceChanges')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'success' } }),
    ]);
  });

  it('reports invalid carts and failures without leaking the token or the cart id', async () => {
    const invalid = setup('invalid');
    expect(
      await invalid.service.refreshExpiredQuotePrices({ cartId: 'c', signinToken: null }),
    ).toEqual({
      status: 'invalid_cart',
    });
    expect(
      await invalid.service.acknowledgePriceChanges({ cartId: 'c', signinToken: null }),
    ).toEqual({
      status: 'invalid_cart',
    });

    const failing = setup('failure');
    const command = { cartId: 'secret-cart', signinToken: TOKEN };
    expect(await failing.service.refreshExpiredQuotePrices(command)).toEqual({ status: 'failed' });
    expect(await failing.service.acknowledgePriceChanges(command)).toEqual({ status: 'failed' });
    expect(JSON.stringify(failing.logLines)).not.toContain(TOKEN);
    expect(JSON.stringify(failing.logLines)).not.toContain('secret-cart');
  });
});

describe('cartService cart details', () => {
  it('reads the cart with the cart id and token', async () => {
    const { gateway, service } = setup('ok');
    expect(await service.getCartDetails({ cartId: 'c', signinToken: TOKEN })).toEqual({
      status: 'ok',
      cart: WITH_EXTRAS,
    });
    expect(gateway.calls).toEqual([
      { op: 'details', cartId: 'c', token: TOKEN },
      { op: 'extras', cartId: 'c', token: TOKEN },
    ]);
  });

  it('updates a quantity and answers the updated cart', async () => {
    const { gateway, service, metricsNamed } = setup('ok');
    expect(
      await service.updateCartItemQuantity({
        cartId: 'c',
        itemUid: 'MTIz',
        quantity: 3,
        signinToken: null,
      }),
    ).toEqual({ status: 'ok', cart: WITH_EXTRAS });
    // The estimate follows the new subtotal, so it is read again after the change.
    expect(gateway.calls).toEqual([
      { op: 'update:MTIz:3', cartId: 'c', token: null },
      { op: 'extras', cartId: 'c', token: null },
    ]);
    expect(metricsNamed('CartUpdateItem')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'success' } }),
    ]);
  });

  it('removes an item and answers the updated cart', async () => {
    const { gateway, service, metricsNamed } = setup('ok');
    expect(
      await service.removeCartDetailsItem({ cartId: 'c', itemUid: 'MTIz', signinToken: TOKEN }),
    ).toEqual({ status: 'ok', cart: WITH_EXTRAS });
    expect(gateway.calls).toEqual([
      { op: 'remove:MTIz', cartId: 'c', token: TOKEN },
      { op: 'extras', cartId: 'c', token: TOKEN },
    ]);
    expect(metricsNamed('CartRemoveItem')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'success' } }),
    ]);
  });

  it('still answers the cart, without estimate or threshold, when the extras cannot be read', async () => {
    const { service, metricsNamed } = setup('ok', true);
    const result = await service.getCartDetails({ cartId: 'c', signinToken: null });
    expect(result).toEqual({ status: 'ok', cart: DETAILS });
    expect(metricsNamed('CartReadFailure')).toEqual([]);
  });

  it('reports a cart Magento rejects as invalid_cart, never creating a cart', async () => {
    const { gateway, service, metricsNamed } = setup('invalid');
    const command = { cartId: 'c', itemUid: 'MTIz', quantity: 2, signinToken: null };

    expect(await service.getCartDetails({ cartId: 'c', signinToken: null })).toEqual({
      status: 'invalid_cart',
    });
    expect(await service.updateCartItemQuantity(command)).toEqual({ status: 'invalid_cart' });
    expect(await service.removeCartDetailsItem(command)).toEqual({ status: 'invalid_cart' });
    expect(gateway.calls.map((call) => call.op)).toEqual([
      'details',
      'update:MTIz:2',
      'remove:MTIz',
    ]);
    expect(metricsNamed('CartUpdateItem')).toEqual([
      expect.objectContaining({ dimensions: { Outcome: 'invalid_cart' } }),
    ]);
  });

  it('reports other failures as failed and never logs the token or the cart id', async () => {
    const { service, logLines } = setup('failure');
    const command = { cartId: 'secret-cart', itemUid: 'MTIz', quantity: 2, signinToken: TOKEN };

    expect(await service.getCartDetails(command)).toEqual({ status: 'failed' });
    expect(await service.updateCartItemQuantity(command)).toEqual({ status: 'failed' });
    expect(await service.removeCartDetailsItem(command)).toEqual({ status: 'failed' });
    expect(logLines.length).toBeGreaterThan(0);
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
    expect(JSON.stringify(logLines)).not.toContain('secret-cart');
  });
});

describe('cart details input schemas', () => {
  const base = { cartId: 'aBcD1234aBcD1234aBcD1234aBcD1234', signinToken: null };

  it('accepts a read, a quantity update and a removal', () => {
    expect(cartDetailsReadInputSchema.safeParse(base).success).toBe(true);
    expect(
      updateCartItemInputSchema.safeParse({ ...base, itemUid: 'MTIz', quantity: 2 }).success,
    ).toBe(true);
    expect(removeCartDetailsItemInputSchema.safeParse({ ...base, itemUid: 'MTIz' }).success).toBe(
      true,
    );
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['huge', 1_000_001],
    ['a string', '2'],
  ])('rejects a quantity that is %s', (_label, quantity) => {
    expect(
      updateCartItemInputSchema.safeParse({ ...base, itemUid: 'MTIz', quantity }).success,
    ).toBe(false);
  });

  it('rejects a missing cart id or a malformed item uid', () => {
    expect(
      updateCartItemInputSchema.safeParse({ ...base, cartId: null, itemUid: 'MTIz', quantity: 1 })
        .success,
    ).toBe(false);
    expect(
      updateCartItemInputSchema.safeParse({ ...base, itemUid: 'a b!', quantity: 1 }).success,
    ).toBe(false);
  });
});
