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
