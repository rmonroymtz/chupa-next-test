/**
 * Products of one recommendation slider (legacy `GetRandomProducts`,
 * `randomProducts.gql.js`). `keywords` and `order` are never sent: the
 * sliders do not depend on the search query.
 */
export const RANDOM_PRODUCTS_QUERY = /* GraphQL */ `
  query GetRandomProducts(
    $limit: Int!
    $type: ProductCarouselType
    $keywords: [String]
    $order: String
  ) {
    randomProducts(limit: $limit, type: $type, keywords: $keywords, order: $order) {
      products {
        sku
        image
        name
        price
        regular_price
        review_stars
        store
        link
      }
      totalProducts
    }
  }
`;
