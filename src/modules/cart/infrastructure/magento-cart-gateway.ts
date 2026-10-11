import 'server-only';
import {
  CartGatewayError,
  type CartAuth,
  type CartGateway,
  type CartUserError,
} from '@/modules/cart/application/ports';
import {
  ADD_PRODUCT_TO_CART_MUTATION,
  CREATE_CART_MUTATION,
  ITEM_COUNT_QUERY,
  MINI_CART_QUERY,
} from '@/modules/cart/infrastructure/cart.queries';
import {
  isInvalidCartMessage,
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
  };
}
