export const RESOLVE_ROUTE_QUERY = /* GraphQL */ `
  query ResolveURL($url: String!) {
    route(url: $url) {
      relative_url
      redirect_code
      type
      ... on CmsPage {
        identifier
      }
      ... on ProductInterface {
        uid
        __typename
      }
      ... on CategoryInterface {
        uid
      }
    }
  }
`;
