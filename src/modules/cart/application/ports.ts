import type { CartItemPayload } from '@/modules/cart/domain/add-to-cart';
import type { Money } from '@/modules/product/domain/product';

export type CartItemInput = CartItemPayload;

/** Sign-in token from the PWA session, already checked for expiry; null for guests. */
export interface CartAuth {
  readonly signinToken: string | null;
}

export interface CartUserError {
  readonly code: string;
  readonly message: string;
}

export interface MiniCartItem {
  readonly uid: string;
  readonly name: string;
  readonly sku: string;
  /** Product page path, e.g. `/amazon-B0X-lamp.html`. */
  readonly url: string;
  readonly thumbnailUrl: string | null;
  readonly quantity: number;
  /** Unit price as Magento returns it. */
  readonly unitPrice: Money | null;
  /** Selected variant options (`configurable_options`). */
  readonly options: readonly { readonly label: string; readonly value: string }[];
  readonly outOfStock: boolean;
}

export interface MiniCart {
  readonly totalQuantity: number;
  /** `prices.subtotal_excluding_tax`, as the legacy mini cart shows. */
  readonly subtotal: Money | null;
  readonly items: readonly MiniCartItem[];
}

export type CartGatewayErrorKind = 'invalid_cart' | 'failure';

/**
 * `invalid_cart`: Magento no longer accepts this cart id for this shopper
 * (missing, inactive, or owned by someone else), the cases peregrine resets.
 */
export class CartGatewayError extends Error {
  override readonly name = 'CartGatewayError';
  constructor(
    readonly kind: CartGatewayErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Magento cart operations. Every method rejects with a {@link CartGatewayError}. */
export interface CartGateway {
  createEmptyCart(auth: CartAuth): Promise<string>;
  addProductToCart(
    cartId: string,
    item: CartItemInput,
    auth: CartAuth,
  ): Promise<{ totalQuantity: number; userErrors: readonly CartUserError[] }>;
  getCartCount(cartId: string, auth: CartAuth): Promise<number>;
  getMiniCart(cartId: string, auth: CartAuth): Promise<MiniCart>;
  /**
   * Removes one item (Magento `removeItemFromCart` by `cart_item_uid`) and
   * answers the updated cart. Magento reports problems as GraphQL errors: the
   * output has no `user_errors`.
   */
  removeItemFromCart(cartId: string, itemUid: string, auth: CartAuth): Promise<MiniCart>;
}
