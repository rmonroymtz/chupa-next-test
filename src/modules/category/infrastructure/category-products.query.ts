/**
 * One page of the products assigned to a category, with the same card fields
 * (and PDP price fields) as the Page Builder products content type.
 */
export const CATEGORY_PRODUCTS_QUERY = /* GraphQL */ `
  query CategoryProducts($uid: String!, $currentPage: Int!, $pageSize: Int!) {
    products(
      filter: { category_uid: { eq: $uid } }
      currentPage: $currentPage
      pageSize: $pageSize
    ) {
      total_count
      page_info {
        current_page
        page_size
        total_pages
      }
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
