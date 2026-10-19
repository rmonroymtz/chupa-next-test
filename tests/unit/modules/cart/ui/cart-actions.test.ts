import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  addToCart: vi.fn(),
  getCartCount: vi.fn(),
  getMiniCart: vi.fn(),
  removeCartItem: vi.fn(),
}));
const warn = vi.hoisted(() => vi.fn());
vi.mock('@/modules/cart/infrastructure/cart.composition', () => ({
  getCartService: () => service,
}));
vi.mock('@/shared/observability/logger', () => ({
  getLogger: () => ({ child: () => ({ warn }) }),
}));

const { removeCartItemAction } = await import('@/modules/cart/ui/cart-actions');

const CART = { totalQuantity: 0, subtotal: null, items: [] };

beforeEach(() => {
  Object.values(service).forEach((mock) => mock.mockReset());
  warn.mockReset();
});

describe('removeCartItemAction', () => {
  it('passes the PWA cart id, token and item uid to the service, like the read actions', async () => {
    service.removeCartItem.mockResolvedValue({ status: 'ok', cart: CART });

    await expect(
      removeCartItemAction({ cartId: 'pwa-cart', signinToken: 'a.b.c', itemUid: 'MTIz' }),
    ).resolves.toEqual({ status: 'ok', cart: CART });
    expect(service.removeCartItem).toHaveBeenCalledWith({
      cartId: 'pwa-cart',
      signinToken: 'a.b.c',
      itemUid: 'MTIz',
    });
  });

  it('rejects an invalid input without reaching Magento and logs only the action name', async () => {
    await expect(
      removeCartItemAction({ cartId: null, signinToken: 'secret', itemUid: 'MTIz' }),
    ).resolves.toEqual({ status: 'failed' });
    expect(service.removeCartItem).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith({ action: 'remove_cart_item' }, 'invalid cart action input');
  });

  it('answers failed when the service cannot be built', async () => {
    service.removeCartItem.mockRejectedValue(new Error('MAGENTO_GRAPHQL_URL is not set'));
    await expect(
      removeCartItemAction({ cartId: 'pwa-cart', signinToken: null, itemUid: 'MTIz' }),
    ).resolves.toEqual({ status: 'failed' });
  });
});
