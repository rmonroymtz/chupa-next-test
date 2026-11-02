import 'server-only';
import {
  CartGatewayError,
  type CartAuth,
  type CartGateway,
  type CartUserError,
} from '@/modules/cart/application/ports';
import {
  ADD_PRODUCT_TO_CART_MUTATION,
  CART_DETAILS_QUERY,
  CART_DETAILS_REMOVE_ITEM_MUTATION,
  CART_SUMMARY_EXTRAS_QUERY,
  CREATE_CART_MUTATION,
  ITEM_COUNT_QUERY,
  MINI_CART_QUERY,
  REMOVE_ITEM_MUTATION,
  UPDATE_ITEM_QUANTITY_MUTATION,
} from '@/modules/cart/infrastructure/cart.queries';
import {
  isInvalidCartMessage,
  mapCartDetails,
  mapCartExtras,
  mapMiniCart,
} from '@/modules/cart/infrastructure/magento-cart-mapper';
import { DEFAULT_PRODUCT_URL_SUFFIX } from '@/modules/product/domain/product-url';
import { MagentoRequestError, type MagentoClient } from '@/shared/graphql/client';

interface AddProductToCartData {
  addProductsToCart: {
    cart: { id: string; total_quantity: number | null } | null;
    user_errors: (CartUserError | null)[] | null;
  } | null;
}

/**
 * Magento cart adapter. The shopper's PWA token goes in `Authorization`
 * exactly as the PWA auth link sends it; it is never logged (the client logs
 * no headers).
 */
export function createMagentoCartGateway(client: MagentoClient): CartGateway {
  async function call<TData>(
    operationName: string,
    query: string,
    variables: Record<string, unknown>,
    auth: CartAuth,
  ): Promise<TData> {
    try {
      return await client.request<TData>({
        operationName,
        query,
        variables,
        ...(auth.signinToken ? { headers: { Authorization: `Bearer ${auth.signinToken}` } } : {}),
      });
    } catch (caught) {
      const invalid =
        caught instanceof MagentoRequestError &&
        caught.kind === 'graphql' &&
        caught.graphqlMessages.some(isInvalidCartMessage);
      throw new CartGatewayError(
        invalid ? 'invalid_cart' : 'failure',
        `Magento ${operationName} failed`,
        { cause: caught },
      );
    }
  }

  return {
    async createEmptyCart(auth) {
      const data = await call<{ cartId: unknown }>('createCart', CREATE_CART_MUTATION, {}, auth);
      if (typeof data.cartId !== 'string' || data.cartId === '') {
        throw new CartGatewayError('failure', 'Magento createCart returned no cart id');
      }
      return data.cartId;
    },

    async addProductToCart(cartId, item, auth) {
      const data = await call<AddProductToCartData>(
        'AddProductToCart',
        ADD_PRODUCT_TO_CART_MUTATION,
        { cartId, product: item },
        auth,
      );
      const result = data.addProductsToCart;
      if (!result)
        throw new CartGatewayError('failure', 'Magento AddProductToCart returned no result');
      return {
        totalQuantity: result.cart?.total_quantity ?? 0,
        userErrors: (result.user_errors ?? []).flatMap((error) =>
          error ? [{ code: String(error.code), message: String(error.message) }] : [],
        ),
      };
    },

    async getCartCount(cartId, auth) {
      const data = await call<{ cart: { total_quantity: number | null } | null }>(
        'getItemCount',
        ITEM_COUNT_QUERY,
        { cartId },
        auth,
      );
      return data.cart?.total_quantity ?? 0;
    },

    async getMiniCart(cartId, auth) {
      const data = await call<{ cart: unknown }>(
        'MiniCartQuery',
        MINI_CART_QUERY,
        { cartId },
        auth,
      );
      // Same suffix the product urls use; the legacy item reads storeConfig's (`.html`).
      return mapMiniCart(data.cart, DEFAULT_PRODUCT_URL_SUFFIX);
    },

    async removeItemFromCart(cartId, itemUid, auth) {
      const data = await call<{ removeItemFromCart: { cart: unknown } | null } | null>(
        'RemoveItemForMiniCart',
        REMOVE_ITEM_MUTATION,
        { cartId, itemId: itemUid },
        auth,
      );
      const cart = data?.removeItemFromCart?.cart;
      if (!cart) {
        throw new CartGatewayError('failure', 'Magento RemoveItemForMiniCart returned no cart');
      }
      return mapMiniCart(cart, DEFAULT_PRODUCT_URL_SUFFIX);
    },

    async getCartDetails(cartId, auth) {
      const data = await call<{ cart: unknown } | null>(
        'GetCartDetails',
        CART_DETAILS_QUERY,
        { cartId },
        auth,
      );
      if (!data?.cart)
        throw new CartGatewayError('failure', 'Magento GetCartDetails returned no cart');
      return mapCartDetails(data.cart, DEFAULT_PRODUCT_URL_SUFFIX);
    },

    async getCartExtras(cartId, auth) {
      const data = await call<unknown>(
        'GetCartSummaryExtras',
        CART_SUMMARY_EXTRAS_QUERY,
        { cartId },
        auth,
      );
      return mapCartExtras(data);
    },

    async updateCartItemQuantity(cartId, itemUid, quantity, auth) {
      const data = await call<{ updateCartItems: { cart: unknown } | null } | null>(
        'updateItemQuantity',
        UPDATE_ITEM_QUANTITY_MUTATION,
        { cartId, itemId: itemUid, quantity },
        auth,
      );
      const cart = data?.updateCartItems?.cart;
      if (!cart)
        throw new CartGatewayError('failure', 'Magento updateItemQuantity returned no cart');
      return mapCartDetails(cart, DEFAULT_PRODUCT_URL_SUFFIX);
    },

    async removeCartDetailsItem(cartId, itemUid, auth) {
      const data = await call<{ removeItemFromCart: { cart: unknown } | null } | null>(
        'removeItem',
        CART_DETAILS_REMOVE_ITEM_MUTATION,
        { cartId, itemId: itemUid },
        auth,
      );
      const cart = data?.removeItemFromCart?.cart;
      if (!cart) throw new CartGatewayError('failure', 'Magento removeItem returned no cart');
      return mapCartDetails(cart, DEFAULT_PRODUCT_URL_SUFFIX);
    },
  };
}
