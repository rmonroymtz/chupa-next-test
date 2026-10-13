/**
 * PDP lookup through `route(url:)` with the product fields inlined.
 *
 * `products(filter: { url_key: { eq } })` returns no items for url keys that
 * contain `|` (verified live), while `route()` resolves them, so the product
 * is read from the route in a single round-trip. CMS identifiers and category
 * uids are selected too, so one call decides how the catch-all page renders.
 */
export const PRODUCT_BY_ROUTE_QUERY = /* GraphQL */ `
  query ProductByRoute($url: String!) {
    route(url: $url) {
      relative_url
      redirect_code
      type
      ... on CmsPage {
        identifier
      }
      ... on CategoryInterface {
        uid
      }
      ... on ProductInterface {
        __typename
        uid
        sku
        name
        url_key
        url_suffix
        description {
          html
        }
        short_description {
          html
        }
        meta_title
        meta_description {
          html
        }
        media_gallery {
          url
          label
          position
          disabled
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
        stock_status
        categories {
          uid
          name
          url_path
          breadcrumbs {
            category_uid
            category_name
            category_url_path
          }
        }
        delivery_to
        product_status
        brand
        related_products {
          uid
          sku
          name
          url_key
          url_suffix
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
            }
          }
        }
        ... on ConfigurableProduct {
          configurable_options {
            uid
            attribute_code
            label
            position
            values {
              uid
              label
              value_index
            }
          }
          variants {
            attributes {
              uid
              code
              label
              value_index
            }
            product {
              uid
              sku
              name
              stock_status
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
                }
              }
            }
          }
        }
      }
    }
  }
`;
