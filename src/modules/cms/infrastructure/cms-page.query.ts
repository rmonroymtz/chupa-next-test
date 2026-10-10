export const CMS_PAGE_QUERY = /* GraphQL */ `
  query CmsPage($identifier: String!) {
    cmsPage(identifier: $identifier) {
      identifier
      url_key
      relative_url
      title
      content
      content_heading
      meta_title
      meta_description
      meta_keywords
      page_layout
    }
  }
`;
