/**
 * Cart GraphQL documents, from the legacy PWA Studio storefront so both apps
 * send Magento the same operations:
 * - `createCart`: peregrine `lib/context/cart.js` (`CREATE_CART_MUTATION`).
 * - `AddProductToCart`: peregrine `talons/ProductFullDetail/productFullDetail.gql.ce.js`
 *   (only the fields the header needs; the PWA refetches its own fragments).
 * - `getItemCount`: venia-ui `Header/cartTrigger.gql.js` (`CartTriggerFragment`).
 * - `MiniCartQuery`: venia-ui `MiniCart/miniCart.gql.js` (`MiniCartFragment`,
 *   `ProductListFragment`), without the variant thumbnails it does not show.
 * - `RemoveItemForMiniCart`: venia-ui `MiniCart/miniCart.gql.js` (`REMOVE_ITEM_MUTATION`).
 * - `GetCartDetails`, `removeItem`, `updateItemQuantity`: the chupaprecios-pwa overrides of
 *   `CartPage/cartPage.gql.js`, `ProductListing/product.js`, with the item fields of its
 *   `ProductListingFragment` the Next page shows (the price summary, coupons, gift cards and
 *   shipping fragments belong to the summary task).
 */

export const CREATE_CART_MUTATION = /* GraphQL */ `
  mutation createCart {
    cartId: createEmptyCart
  }
`;

export const ADD_PRODUCT_TO_CART_MUTATION = /* GraphQL */ `
  mutation AddProductToCart($cartId: String!, $product: CartItemInput!) {
    addProductsToCart(cartId: $cartId, cartItems: [$product]) {
      cart {
        id
        total_quantity
      }
      user_errors {
        code
        message
      }
    }
  }
`;

export const ITEM_COUNT_QUERY = /* GraphQL */ `
  query getItemCount($cartId: String!) {
    cart(cart_id: $cartId) {
      id
      total_quantity
    }
  }
`;

/** `MiniCartFragment` + `ProductListFragment` fields the Next mini cart shows. */
const MINI_CART_FIELDS = /* GraphQL */ `
      id
      total_quantity
      prices {
        subtotal_excluding_tax {
          currency
          value
        }
      }
      items {
        uid
        product {
          uid
          name
          sku
          url_key
          thumbnail {
            url
          }
          stock_status
        }
        prices {
          price {
            currency
            value
          }
        }
        quantity
        ... on ConfigurableCartItem {
          configurable_options {
            option_label
            value_label
          }
        }
      }
`;

export const MINI_CART_QUERY = /* GraphQL */ `
  query MiniCartQuery($cartId: String!) {
    cart(cart_id: $cartId) {${MINI_CART_FIELDS}    }
  }
`;

/**
 * venia-ui `MiniCart/miniCart.gql.js` (`REMOVE_ITEM_MUTATION`): same operation
 * name and input; it answers the mini-cart fields so the panel updates from
 * the response, as the PWA Apollo cache does (without `CartPageFragment`,
 * which only feeds the PWA cart page cache).
 */
export const REMOVE_ITEM_MUTATION = /* GraphQL */ `
  mutation RemoveItemForMiniCart($cartId: String!, $itemId: ID!) {
    removeItemFromCart(input: { cart_id: $cartId, cart_item_uid: $itemId }) {
      cart {${MINI_CART_FIELDS}      }
    }
  }
`;

/**
 * Fields of the legacy `ProductListingFragment` the Next cart page shows.
 * `cp_price_change` is only asked for with the backend switch on: with it off
 * Magento may not know the field (legacy `CHUPAPRECIOS_CART_REFRESH_BACKEND`).
 */
function cartDetailsFields(priceChangeNotices: boolean): string {
  const priceChange = priceChangeNotices
    ? `
        cp_price_change {
          changed
          previous_price
          current_price
          delta
          out_of_stock
        }`
    : '';
  return /* GraphQL */ `
      id
      total_quantity
      prices {
        subtotal_excluding_tax {
          currency
          value
        }
        grand_total {
          currency
          value
        }
        discounts {
          amount {
            currency
            value
          }
          label
        }
        applied_taxes {
          amount {
            currency
            value
          }
        }
      }
      shipping_addresses {
        selected_shipping_method {
          amount {
            currency
            value
          }
        }
      }
      items {
        uid
        product {
          uid
          name
          sku
          url_key
          thumbnail {
            url
          }
          small_image {
            url
          }
          stock_status
        }
        prices {
          price {
            currency
            value
          }
          row_total {
            value
          }
        }
        quantity
        is_from_quote
        quote_expiration_date
        is_quote_price_expired
        out_of_stock${priceChange}
        ... on ConfigurableCartItem {
          configurable_options {
            option_label
            value_label
          }
        }
      }
`;
}

export const cartDetailsQuery = (priceChangeNotices: boolean): string => /* GraphQL */ `
  query GetCartDetails($cartId: String!) {
    cart(cart_id: $cartId) {${cartDetailsFields(priceChangeNotices)}    }
  }
`;

export const cartDetailsRemoveItemMutation = (
  priceChangeNotices: boolean,
): string => /* GraphQL */ `
  mutation removeItem($cartId: String!, $itemId: ID!) {
    removeItemFromCart(input: { cart_id: $cartId, cart_item_uid: $itemId }) {
      cart {${cartDetailsFields(priceChangeNotices)}      }
    }
  }
`;

export const updateItemQuantityMutation = (priceChangeNotices: boolean): string => /* GraphQL */ `
  mutation updateItemQuantity($cartId: String!, $itemId: ID!, $quantity: Float!) {
    updateCartItems(
      input: { cart_id: $cartId, cart_items: [{ cart_item_uid: $itemId, quantity: $quantity }] }
    ) {
      cart {${cartDetailsFields(priceChangeNotices)}      }
    }
  }
`;

/** `@chupaprecios/dashboard` `graphql/cotizaciones.gql.js`; the cart is read again afterwards. */
export const REFRESH_EXPIRED_QUOTE_PRICES_MUTATION = /* GraphQL */ `
  mutation RefreshExpiredQuoteCartItemPrices($cart_id: String!) {
    refreshExpiredQuoteCartItemPrices(cart_id: $cart_id) {
      items_renewed {
        cart_item_uid
        product_sku
        product_name
        previous_price
        new_price
        quote_request_id
      }
      quotes_renewed
    }
  }
`;

/** `useCartPriceChanges` dismiss mutation; answers a scalar. */
export const ACKNOWLEDGE_PRICE_CHANGES_MUTATION = /* GraphQL */ `
  mutation AcknowledgeCartPriceChanges($cartId: String!) {
    acknowledgeCartPriceChanges(cart_id: $cartId)
  }
`;

/**
 * `GetShippingEstimate` (`@chupaprecios/cart-price-summary` `priceSummary.gql.js`) and
 * `FreeShippingMessage`'s `storeConfig.free_shipping_subtotal`, in one request.
 */
export const CART_SUMMARY_EXTRAS_QUERY = /* GraphQL */ `
  query GetCartSummaryExtras($cartId: String!) {
    cart(cart_id: $cartId) {
      id
      prices {
        chupaprecios_shipping_estimate {
          value
          currency
        }
      }
    }
    storeConfig {
      free_shipping_subtotal
    }
  }
`;
