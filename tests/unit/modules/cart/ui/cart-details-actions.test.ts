import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  getCartDetails: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  removeCartDetailsItem: vi.fn(),
}));
const warn = vi.hoisted(() => vi.fn());
vi.mock('@/modules/cart/infrastructure/cart.composition', () => ({
  getCartService: () => service,
}));
vi.mock('@/shared/observability/logger', () => ({
  getLogger: () => ({ child: () => ({ warn }) }),
}));

const { getCartDetailsAction, updateCartItemAction, removeCartDetailsItemAction } =
  await import('@/modules/cart/ui/cart-actions');

const CART = { totalQuantity: 0, items: [] };
const AUTH = { cartId: 'pwa-cart', signinToken: 'a.b.c' };

beforeEach(() => {
  Object.values(service).forEach((mock) => mock.mockReset());
  warn.mockReset();
});

describe('cart details actions', () => {
  it('pass the PWA cart id, token and item to the service', async () => {
    service.getCartDetails.mockResolvedValue({ status: 'ok', cart: CART });
    service.updateCartItemQuantity.mockResolvedValue({ status: 'ok', cart: CART });
    service.removeCartDetailsItem.mockResolvedValue({ status: 'ok', cart: CART });

    await expect(getCartDetailsAction(AUTH)).resolves.toEqual({ status: 'ok', cart: CART });
    await expect(updateCartItemAction({ ...AUTH, itemUid: 'MTIz', quantity: 3 })).resolves.toEqual({
      status: 'ok',
      cart: CART,
    });
    await expect(removeCartDetailsItemAction({ ...AUTH, itemUid: 'MTIz' })).resolves.toEqual({
      status: 'ok',
      cart: CART,
    });
    expect(service.getCartDetails).toHaveBeenCalledWith(AUTH);
    expect(service.updateCartItemQuantity).toHaveBeenCalledWith({
      ...AUTH,
      itemUid: 'MTIz',
      quantity: 3,
    });
    expect(service.removeCartDetailsItem).toHaveBeenCalledWith({ ...AUTH, itemUid: 'MTIz' });
  });

  it('reject an invalid input without reaching Magento and log only the action name', async () => {
    await expect(getCartDetailsAction({ cartId: null, signinToken: 'secret' })).resolves.toEqual({
      status: 'failed',
    });
    await expect(updateCartItemAction({ ...AUTH, itemUid: 'MTIz', quantity: 0 })).resolves.toEqual({
      status: 'failed',
    });
    await expect(removeCartDetailsItemAction({ ...AUTH, itemUid: '' })).resolves.toEqual({
      status: 'failed',
    });
    expect(service.getCartDetails).not.toHaveBeenCalled();
    expect(service.updateCartItemQuantity).not.toHaveBeenCalled();
    expect(service.removeCartDetailsItem).not.toHaveBeenCalled();
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      { action: 'cart_details' },
      { action: 'update_cart_item' },
      { action: 'remove_cart_details_item' },
    ]);
  });

  it('answer failed when the service cannot be built', async () => {
    service.getCartDetails.mockRejectedValue(new Error('MAGENTO_GRAPHQL_URL is not set'));
    await expect(getCartDetailsAction(AUTH)).resolves.toEqual({ status: 'failed' });
  });
});
