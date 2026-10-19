import { describe, expect, it } from 'vitest';
import {
  CartGatewayError,
  type CartGateway,
  type CartItemInput,
  type MiniCart,
} from '@/modules/cart/application/ports';
import { createCartService } from '@/modules/cart/application/cart-service';
import { createCapturingObservability } from '../../../../support/observability';

const ITEM: CartItemInput = { sku: 'B0ASIN0001', quantity: 1, vendor: 'amazon' };
const TOKEN = 'secret.jwt.token';

type Step =
  | 'invalid'
  | 'failure'
  | { totalQuantity: number; userErrors?: { code: string; message: string }[] };

/** Scripted gateway: each call consumes the next scripted answer. */
class ScriptedGateway implements CartGateway {
  readonly calls: { op: string; cartId?: string; token: string | null }[] = [];
  private created = 0;

  constructor(
    private readonly addSteps: Step[] = [],
    private readonly createFails = false,
    private readonly readStep: Step = { totalQuantity: 0 },
  ) {}

  async createEmptyCart(auth: { signinToken: string | null }): Promise<string> {
    this.calls.push({ op: 'create', token: auth.signinToken });
    if (this.createFails) throw new CartGatewayError('failure', 'boom');
    this.created += 1;
    return `new-cart-${this.created}`;
  }

  async addProductToCart(
    cartId: string,
    item: CartItemInput,
    auth: { signinToken: string | null },
  ) {
    expect(item).toEqual(ITEM);
    this.calls.push({ op: 'add', cartId, token: auth.signinToken });
    const step = this.addSteps.shift() ?? 'failure';
    return answer(step);
  }

  async getCartCount(cartId: string, auth: { signinToken: string | null }) {
    this.calls.push({ op: 'count', cartId, token: auth.signinToken });
    return (await answer(this.readStep)).totalQuantity;
  }

  async getMiniCart(cartId: string, auth: { signinToken: string | null }): Promise<MiniCart> {
    this.calls.push({ op: 'mini', cartId, token: auth.signinToken });
    const { totalQuantity } = await answer(this.readStep);
    return { totalQuantity, subtotal: null, items: [] };
  }

  async removeItemFromCart(
    cartId: string,
    itemUid: string,
    auth: { signinToken: string | null },
  ): Promise<MiniCart> {
    this.calls.push({ op: `remove:${itemUid}`, cartId, token: auth.signinToken });
    const { totalQuantity } = await answer(this.readStep);
    return { totalQuantity, subtotal: null, items: [] };
  }
}

async function answer(step: Step) {
  if (step === 'invalid')
    throw new CartGatewayError('invalid_cart', 'Could not find a cart with ID "x"');
  if (step === 'failure') throw new CartGatewayError('failure', 'Magento down');
  return { totalQuantity: step.totalQuantity, userErrors: step.userErrors ?? [] };
}

function setup(gateway: CartGateway) {
  const observability = createCapturingObservability();
  const service = createCartService({
    gateway,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { service, ...observability };
}

describe('cartService.addToCart', () => {
  it('adds to the existing cart and reports no new cart id', async () => {
    const gateway = new ScriptedGateway([{ totalQuantity: 3 }]);
    const { service, metricsNamed } = setup(gateway);

    const result = await service.addToCart({ cartId: 'pwa-cart', signinToken: null, item: ITEM });

    expect(result).toEqual({ status: 'added', newCartId: null, totalQuantity: 3, userErrors: [] });
    expect(gateway.calls).toEqual([{ op: 'add', cartId: 'pwa-cart', token: null }]);
    expect(metricsNamed('CartAddToCart')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'success' } }),
    ]);
  });

  it('creates a cart (with the token) when there is none, then adds to it', async () => {
    const gateway = new ScriptedGateway([{ totalQuantity: 1 }]);
    const { service, metricsNamed } = setup(gateway);

    const result = await service.addToCart({ cartId: null, signinToken: TOKEN, item: ITEM });

    expect(result).toEqual({
      status: 'added',
      newCartId: 'new-cart-1',
      totalQuantity: 1,
      userErrors: [],
    });
    expect(gateway.calls).toEqual([
      { op: 'create', token: TOKEN },
      { op: 'add', cartId: 'new-cart-1', token: TOKEN },
    ]);
    expect(metricsNamed('CartCreated')).toEqual([
      expect.objectContaining({ dimensions: { Reason: 'missing' } }),
    ]);
  });

  it('recovers an invalid cart once: new cart, retry, new id returned', async () => {
    const gateway = new ScriptedGateway(['invalid', { totalQuantity: 1 }]);
    const { service, metricsNamed, logLines } = setup(gateway);

    const result = await service.addToCart({ cartId: 'stale', signinToken: null, item: ITEM });

    expect(result).toEqual({
      status: 'added',
      newCartId: 'new-cart-1',
      totalQuantity: 1,
      userErrors: [],
    });
    expect(gateway.calls.map((call) => call.op)).toEqual(['add', 'create', 'add']);
    expect(metricsNamed('CartRecovered')).toHaveLength(1);
    expect(metricsNamed('CartCreated')).toEqual([
      expect.objectContaining({ dimensions: { Reason: 'recovery' } }),
    ]);
    expect(JSON.stringify(logLines)).not.toContain('stale');
  });

  it('does not retry a second time when the recovered cart is also rejected', async () => {
    const gateway = new ScriptedGateway(['invalid', 'invalid']);
    const { service, metricsNamed } = setup(gateway);

    const result = await service.addToCart({ cartId: 'stale', signinToken: null, item: ITEM });

    expect(result).toEqual({ status: 'failed', newCartId: 'new-cart-1' });
    expect(gateway.calls.map((call) => call.op)).toEqual(['add', 'create', 'add']);
    expect(metricsNamed('CartAddToCart')).toEqual([
      expect.objectContaining({ dimensions: { Outcome: 'failure' } }),
    ]);
  });

  it('does not recover a freshly created cart that Magento rejects', async () => {
    const gateway = new ScriptedGateway(['invalid']);
    const { service } = setup(gateway);

    const result = await service.addToCart({ cartId: null, signinToken: null, item: ITEM });

    expect(result).toEqual({ status: 'failed', newCartId: 'new-cart-1' });
    expect(gateway.calls.map((call) => call.op)).toEqual(['create', 'add']);
  });

  it('fails without creating a cart on other errors', async () => {
    const gateway = new ScriptedGateway(['failure']);
    const { service } = setup(gateway);

    expect(await service.addToCart({ cartId: 'pwa-cart', signinToken: null, item: ITEM })).toEqual({
      status: 'failed',
      newCartId: null,
    });
    expect(gateway.calls.map((call) => call.op)).toEqual(['add']);
  });

  it('fails when the cart cannot be created', async () => {
    const gateway = new ScriptedGateway([], true);
    const { service } = setup(gateway);

    expect(await service.addToCart({ cartId: null, signinToken: null, item: ITEM })).toEqual({
      status: 'failed',
      newCartId: null,
    });
  });

  it('returns Magento user errors with the cart and counts them as user_error', async () => {
    const userErrors = [{ code: 'INSUFFICIENT_STOCK', message: 'No hay suficientes existencias' }];
    const gateway = new ScriptedGateway([{ totalQuantity: 0, userErrors }]);
    const { service, metricsNamed } = setup(gateway);

    expect(await service.addToCart({ cartId: 'c', signinToken: null, item: ITEM })).toEqual({
      status: 'added',
      newCartId: null,
      totalQuantity: 0,
      userErrors,
    });
    expect(metricsNamed('CartAddToCart')).toEqual([
      expect.objectContaining({ dimensions: { Outcome: 'user_error' } }),
    ]);
  });

  it('never logs the sign-in token', async () => {
    const gateway = new ScriptedGateway(['failure']);
    const { service, logLines } = setup(gateway);

    await service.addToCart({ cartId: 'c', signinToken: TOKEN, item: ITEM });

    expect(logLines.length).toBeGreaterThan(0);
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
  });
});

describe('cartService reads', () => {
  it('returns the item count of an existing cart', async () => {
    const gateway = new ScriptedGateway([], false, { totalQuantity: 4 });
    const { service } = setup(gateway);
    expect(await service.getCartCount({ cartId: 'c', signinToken: TOKEN })).toEqual({
      status: 'ok',
      totalQuantity: 4,
    });
    expect(gateway.calls).toEqual([{ op: 'count', cartId: 'c', token: TOKEN }]);
  });

  it('reports an invalid cart without creating one (the next add recovers it)', async () => {
    const gateway = new ScriptedGateway([], false, 'invalid');
    const { service } = setup(gateway);
    expect(await service.getCartCount({ cartId: 'c', signinToken: null })).toEqual({
      status: 'invalid_cart',
    });
    expect(await service.getMiniCart({ cartId: 'c', signinToken: null })).toEqual({
      status: 'invalid_cart',
    });
    expect(gateway.calls.map((call) => call.op)).toEqual(['count', 'mini']);
  });

  it('reports other read failures as failed', async () => {
    const gateway = new ScriptedGateway([], false, 'failure');
    const { service } = setup(gateway);
    expect(await service.getMiniCart({ cartId: 'c', signinToken: null })).toEqual({
      status: 'failed',
    });
  });

  it('returns the mini cart', async () => {
    const gateway = new ScriptedGateway([], false, { totalQuantity: 2 });
    const { service } = setup(gateway);
    expect(await service.getMiniCart({ cartId: 'c', signinToken: null })).toEqual({
      status: 'ok',
      cart: { totalQuantity: 2, subtotal: null, items: [] },
    });
  });
});

describe('cartService.removeCartItem', () => {
  it('removes the item from the given cart with the token and returns the updated cart', async () => {
    const gateway = new ScriptedGateway([], false, { totalQuantity: 1 });
    const { service, metricsNamed } = setup(gateway);

    expect(
      await service.removeCartItem({ cartId: 'c', itemUid: 'MTIz', signinToken: TOKEN }),
    ).toEqual({ status: 'ok', cart: { totalQuantity: 1, subtotal: null, items: [] } });
    expect(gateway.calls).toEqual([{ op: 'remove:MTIz', cartId: 'c', token: TOKEN }]);
    expect(metricsNamed('CartRemoveItem')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'success' } }),
    ]);
  });

  it('reports a cart Magento rejects as invalid_cart, without creating a cart', async () => {
    const gateway = new ScriptedGateway([], false, 'invalid');
    const { service, metricsNamed } = setup(gateway);

    expect(
      await service.removeCartItem({ cartId: 'c', itemUid: 'MTIz', signinToken: null }),
    ).toEqual({ status: 'invalid_cart' });
    expect(gateway.calls.map((call) => call.op)).toEqual(['remove:MTIz']);
    expect(metricsNamed('CartRemoveItem')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Outcome: 'invalid_cart' } }),
    ]);
  });

  it('reports other failures as failed and never logs the token or the cart id', async () => {
    const gateway = new ScriptedGateway([], false, 'failure');
    const { service, logLines } = setup(gateway);

    expect(
      await service.removeCartItem({ cartId: 'secret-cart', itemUid: 'MTIz', signinToken: TOKEN }),
    ).toEqual({ status: 'failed' });
    expect(logLines.length).toBeGreaterThan(0);
    expect(JSON.stringify(logLines)).not.toContain(TOKEN);
    expect(JSON.stringify(logLines)).not.toContain('secret-cart');
  });
});
