const CATEGORY_FIELDS = /* GraphQL */ `
  uid
  include_in_menu
  name
  position
  url_path
`;

/**
 * Legacy `getMegaMenu` (three levels below the store root) plus the
 * `category_url_suffix` the legacy reads with a second query, in one request.
 */
export const HEADER_MENU_QUERY = /* GraphQL */ `
  query HeaderMenu {
    storeConfig {
      store_code
      category_url_suffix
    }
    categoryList {
      uid
      name
      children {
        ${CATEGORY_FIELDS}
        children {
          ${CATEGORY_FIELDS}
          children {
            ${CATEGORY_FIELDS}
          }
        }
      }
    }
  }
`;
