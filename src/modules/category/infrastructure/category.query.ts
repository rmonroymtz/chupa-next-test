/**
 * Category by uid plus the store's `category_url_suffix`, in one request
 * (Venia builds the category url from `url_path` + `category_url_suffix`).
 */
export const CATEGORY_BY_UID_QUERY = /* GraphQL */ `
  query CategoryByUid($uid: String!) {
    storeConfig {
      store_code
      category_url_suffix
    }
    categoryList(filters: { category_uid: { eq: $uid } }) {
      uid
      name
      description
      url_key
      url_path
      meta_title
      meta_description
      breadcrumbs {
        category_uid
        category_name
        category_url_path
        category_level
      }
    }
  }
`;
