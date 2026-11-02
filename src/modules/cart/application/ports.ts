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

/** One row of the `/cart` page (legacy `ProductListingFragment`). */
export interface CartDetailsItem {
  readonly uid: string;
  readonly name: string;
  readonly sku: string;
  /** Product page path, e.g. `/amazon-B0X-lamp.html`. */
  readonly url: string;
  /** `small_image`, else `thumbnail`. */
  readonly imageUrl: string | null;
  readonly quantity: number;
  /** Unit price as Magento returns it. */
  readonly unitPrice: Money | null;
  /** Selected variant options (`configurable_options`). */
  readonly options: readonly { readonly label: string; readonly value: string }[];
  /** Item `out_of_stock` flag or product stock status `OUT_OF_STOCK`. */
  readonly outOfStock: boolean;
  /** The item was added from a quote (legacy `is_from_quote`). */
  readonly isFromQuote: boolean;
}

/** Cart prices the `/cart` summary shows (legacy `PriceSummaryFragment` + the Chupaprecios wrapper). */
export interface CartSummary {
  /** `prices.subtotal_excluding_tax`. */
  readonly subtotal: Money | null;
  readonly discounts: readonly { readonly label: string; readonly amount: Money }[];
  /** `prices.applied_taxes` amounts. */
  readonly taxes: readonly Money[];
  /** Selected shipping method amount; null until the shopper picked one (cart page: always). */
  readonly selectedShipping: Money | null;
  /** `chupaprecios_shipping_estimate`; filled by the service, null when unknown. */
  readonly shippingEstimate: Money | null;
  /** `prices.grand_total`, which leaves shipping out until a method is selected. */
  readonly grandTotal: Money | null;
  /** `storeConfig.free_shipping_subtotal`; filled by the service, null when unknown. */
  readonly freeShippingThreshold: number | null;
}

export interface CartDetails {
  readonly totalQuantity: number;
  readonly items: readonly CartDetailsItem[];
  readonly summary: CartSummary;
}

/** The two summary values that come from their own Magento query (legacy `GetShippingEstimate`, `FreeShippingMessage`). */
export interface CartExtras {
  readonly shippingEstimate: Money | null;
  readonly freeShippingThreshold: number | null;
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
  /** The `/cart` page read (legacy `GetCartDetails`). */
  getCartDetails(cartId: string, auth: CartAuth): Promise<CartDetails>;
  /** Shipping estimate and free shipping threshold; the estimate follows the cart subtotal. */
  getCartExtras(cartId: string, auth: CartAuth): Promise<CartExtras>;
  /** Sets one item's quantity (`updateCartItems`) and answers the updated cart. */
  updateCartItemQuantity(
    cartId: string,
    itemUid: string,
    quantity: number,
    auth: CartAuth,
  ): Promise<CartDetails>;
  /** Removes one item from the `/cart` page and answers the updated cart. */
  removeCartDetailsItem(cartId: string, itemUid: string, auth: CartAuth): Promise<CartDetails>;
}
