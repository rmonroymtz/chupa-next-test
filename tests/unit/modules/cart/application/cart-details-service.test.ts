import { describe, expect, it } from 'vitest';
import {
  CartGatewayError,
  type CartAuth,
  type CartDetails,
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
const DETAILS: CartDetails = { totalQuantity: 2, items: [] };

type Step = 'invalid' | 'failure' | 'ok';

/** Gateway that only knows the cart page operations; the rest is never called. */
class DetailsGateway {
  readonly calls: { op: string; cartId: string; token: string | null }[] = [];
  constructor(private readonly step: Step) {}

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
}

function setup(step: Step) {
  const gateway = new DetailsGateway(step);
  const observability = createCapturingObservability();
  const service = createCartService({
    gateway: gateway as unknown as CartGateway,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway, service, ...observability };
}

describe('cartService cart details', () => {
  it('reads the cart with the cart id and token', async () => {
    const { gateway, service } = setup('ok');
    expect(await service.getCartDetails({ cartId: 'c', signinToken: TOKEN })).toEqual({
      status: 'ok',
      cart: DETAILS,
    });
    expect(gateway.calls).toEqual([{ op: 'details', cartId: 'c', token: TOKEN }]);
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
    ).toEqual({ status: 'ok', cart: DETAILS });
    expect(gateway.calls).toEqual([{ op: 'update:MTIz:3', cartId: 'c', token: null }]);
    expect(metricsNamed('CartUpdateItem')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'success' } }),
    ]);
  });

  it('removes an item and answers the updated cart', async () => {
    const { gateway, service, metricsNamed } = setup('ok');
    expect(
      await service.removeCartDetailsItem({ cartId: 'c', itemUid: 'MTIz', signinToken: TOKEN }),
    ).toEqual({ status: 'ok', cart: DETAILS });
    expect(gateway.calls).toEqual([{ op: 'remove:MTIz', cartId: 'c', token: TOKEN }]);
    expect(metricsNamed('CartRemoveItem')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'success' } }),
    ]);
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
