'use server';

import type { AddToCartResult, CartReadResult } from '@/modules/cart/application/cart-service';
import {
  addToCartInputSchema,
  cartReadInputSchema,
  removeCartItemInputSchema,
} from '@/modules/cart/application/cart-input';
import type { MiniCart } from '@/modules/cart/application/ports';
import { getCartService } from '@/modules/cart/infrastructure/cart.composition';
import { getLogger } from '@/shared/observability/logger';

/**
 * Cart Server Actions: the only way the browser reaches Magento for the cart
 * (no `/api/*` route; that prefix belongs to the scraper API at the edge).
 * The browser passes the PWA cart id and, when unexpired, the PWA sign-in
 * token; neither is logged. Nothing here is cached.
 */

export async function addToCartAction(input: unknown): Promise<AddToCartResult> {
  const parsed = addToCartInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('add_to_cart');
    return { status: 'failed', newCartId: null };
  }
  const { cartId, signinToken, item } = parsed.data;
  const { selected_options: selectedOptions, ...base } = item;
  try {
    return await getCartService().addToCart({
      cartId,
      signinToken,
      item: selectedOptions ? { ...base, selected_options: selectedOptions } : base,
    });
  } catch {
    // Only configuration errors can get here; the service never rejects.
    return { status: 'failed', newCartId: null };
  }
}

export async function getCartCountAction(
  input: unknown,
): Promise<CartReadResult<{ totalQuantity: number }>> {
  const parsed = cartReadInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('cart_count');
    return { status: 'failed' };
  }
  try {
    return await getCartService().getCartCount(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function getMiniCartAction(
  input: unknown,
): Promise<CartReadResult<{ cart: MiniCart }>> {
  const parsed = cartReadInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('mini_cart');
    return { status: 'failed' };
  }
  try {
    return await getCartService().getMiniCart(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

/** Removes one mini-cart item; answers the updated cart (same cart id/token as the reads). */
export async function removeCartItemAction(
  input: unknown,
): Promise<CartReadResult<{ cart: MiniCart }>> {
  const parsed = removeCartItemInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('remove_cart_item');
    return { status: 'failed' };
  }
  try {
    return await getCartService().removeCartItem(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

/** Logs only the action name: the rejected input may hold a token. */
function warnInvalidInput(action: string): void {
  try {
    getLogger().child({ component: 'cart' }).warn({ action }, 'invalid cart action input');
  } catch {
    // Logging is best effort.
  }
}
