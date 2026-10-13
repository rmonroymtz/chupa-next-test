/**
 * Products listed by a Page Builder `products` content type (legacy
 * `getProductsByUrlKey`), with the same price fields as the PDP so cards and
 * product pages show the same price.
 */
export const PRODUCTS_BY_URL_KEYS_QUERY = /* GraphQL */ `
  query ProductsByUrlKeys($urlKeys: [String], $pageSize: Int!) {
    products(filter: { url_key: { in: $urlKeys } }, pageSize: $pageSize) {
      items {
        uid
        sku
        name
        url_key
        url_suffix
        stock_status
        small_image {
          url
          label
        }
        price_range {
          minimum_price {
            final_price {
              value
              currency
            }
            regular_price {
              value
              currency
            }
            discount {
              amount_off
              percent_off
            }
          }
        }
      }
    }
  }
`;
