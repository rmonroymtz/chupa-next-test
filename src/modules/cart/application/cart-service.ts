import type { Logger } from 'pino';
import {
  CartGatewayError,
  type CartAuth,
  type CartGateway,
  type CartItemInput,
  type CartUserError,
  type MiniCart,
} from '@/modules/cart/application/ports';
import type { MetricsEmitter } from '@/shared/observability/metrics';

export interface AddToCartCommand extends CartAuth {
  /** Cart id from PWA storage; null when the shopper has none. */
  readonly cartId: string | null;
  readonly item: CartItemInput;
}

export type AddToCartResult =
  | {
      readonly status: 'added';
      /** Set when a cart was created: the browser must store it (PWA format). */
      readonly newCartId: string | null;
      readonly totalQuantity: number;
      readonly userErrors: readonly CartUserError[];
    }
  | { readonly status: 'failed'; readonly newCartId: string | null };

export type CartReadResult<T> =
  | ({ readonly status: 'ok' } & T)
  | { readonly status: 'invalid_cart' }
  | { readonly status: 'failed' };

export interface CartReadCommand extends CartAuth {
  readonly cartId: string;
}

export interface RemoveCartItemCommand extends CartReadCommand {
  readonly itemUid: string;
}

export interface CartService {
  addToCart(command: AddToCartCommand): Promise<AddToCartResult>;
  getCartCount(command: CartReadCommand): Promise<CartReadResult<{ totalQuantity: number }>>;
  getMiniCart(command: CartReadCommand): Promise<CartReadResult<{ cart: MiniCart }>>;
  /**
   * Removes an item and answers the updated cart (the PWA mini cart reads it
   * from the mutation, no second query). A cart Magento rejects is reported
   * as `invalid_cart` and never recreated: there is nothing to remove from.
   */
  removeCartItem(command: RemoveCartItemCommand): Promise<CartReadResult<{ cart: MiniCart }>>;
}

export interface CartServiceDeps {
  readonly gateway: CartGateway;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
}

/**
 * Cart use cases behind the Server Actions. Cart ids and tokens are never
 * logged: either one lets anyone operate the shopper's cart.
 *
 * Recovery follows peregrine `getCartDetails`: when Magento rejects the cart
 * id (`Could not find a cart`, inactive, or not the current user's), a new
 * cart is created and the operation retried once. Unlike peregrine, a signed-in
 * shopper is not signed out here (this storefront never writes the token);
 * PWA Studio applies its own rules on its next load.
 */
export function createCartService({ gateway, logger, metrics }: CartServiceDeps): CartService {
  async function createCart(auth: CartAuth, reason: 'missing' | 'recovery'): Promise<string> {
    const cartId = await gateway.createEmptyCart(auth);
    metrics.emitMetric({ name: 'CartCreated', value: 1, dimensions: { Reason: reason } });
    logger.info({ reason, signedIn: auth.signinToken !== null }, 'cart created');
    return cartId;
  }

  async function addToCart({
    cartId,
    signinToken,
    item,
  }: AddToCartCommand): Promise<AddToCartResult> {
    const auth = { signinToken };
    const signedIn = signinToken !== null;
    let newCartId: string | null = null;
    try {
      let target = cartId;
      if (target === null) {
        target = await createCart(auth, 'missing');
        newCartId = target;
      }
      let added;
      try {
        added = await gateway.addProductToCart(target, item, auth);
      } catch (caught) {
        // Recover a stale id from storage once; a cart we just created is not retried.
        if (!(caught instanceof CartGatewayError) || caught.kind !== 'invalid_cart' || newCartId) {
          throw caught;
        }
        metrics.emitMetric({ name: 'CartRecovered', value: 1 });
        logger.warn({ signedIn }, 'cart rejected by Magento, creating a new one');
        newCartId = await createCart(auth, 'recovery');
        added = await gateway.addProductToCart(newCartId, item, auth);
      }
      const outcome = added.userErrors.length > 0 ? 'user_error' : 'success';
      metrics.emitMetric({ name: 'CartAddToCart', value: 1, dimensions: { Outcome: outcome } });
      logger.info(
        { outcome, signedIn, userErrorCodes: added.userErrors.map((error) => error.code) },
        'add to cart',
      );
      return { status: 'added', newCartId, ...added };
    } catch (caught) {
      metrics.emitMetric({ name: 'CartAddToCart', value: 1, dimensions: { Outcome: 'failure' } });
      logger.error(
        { signedIn, kind: caught instanceof CartGatewayError ? caught.kind : 'unexpected' },
        'add to cart failed',
      );
      return { status: 'failed', newCartId };
    }
  }

  async function read<T>(
    operation: 'count' | 'mini_cart',
    signedIn: boolean,
    run: () => Promise<T>,
  ): Promise<CartReadResult<T>> {
    try {
      return { status: 'ok', ...(await run()) };
    } catch (caught) {
      const invalid = caught instanceof CartGatewayError && caught.kind === 'invalid_cart';
      const outcome = invalid ? 'invalid_cart' : 'failure';
      metrics.emitMetric({
        name: 'CartReadFailure',
        value: 1,
        dimensions: { Operation: operation, Outcome: outcome },
      });
      logger.warn({ operation, outcome, signedIn }, 'cart read failed');
      return { status: invalid ? 'invalid_cart' : 'failed' };
    }
  }

  async function removeCartItem({
    cartId,
    itemUid,
    signinToken,
  }: RemoveCartItemCommand): Promise<CartReadResult<{ cart: MiniCart }>> {
    const signedIn = signinToken !== null;
    try {
      const cart = await gateway.removeItemFromCart(cartId, itemUid, { signinToken });
      metrics.emitMetric({ name: 'CartRemoveItem', value: 1, dimensions: { Outcome: 'success' } });
      logger.info({ outcome: 'success', signedIn }, 'remove cart item');
      return { status: 'ok', cart };
    } catch (caught) {
      const invalid = caught instanceof CartGatewayError && caught.kind === 'invalid_cart';
      const outcome = invalid ? 'invalid_cart' : 'failure';
      metrics.emitMetric({ name: 'CartRemoveItem', value: 1, dimensions: { Outcome: outcome } });
      logger.warn({ outcome, signedIn }, 'remove cart item failed');
      return { status: invalid ? 'invalid_cart' : 'failed' };
    }
  }

  return {
    addToCart,
    removeCartItem,
    getCartCount: ({ cartId, signinToken }) =>
      read('count', signinToken !== null, async () => ({
        totalQuantity: await gateway.getCartCount(cartId, { signinToken }),
      })),
    getMiniCart: ({ cartId, signinToken }) =>
      read('mini_cart', signinToken !== null, async () => ({
        cart: await gateway.getMiniCart(cartId, { signinToken }),
      })),
  };
}
