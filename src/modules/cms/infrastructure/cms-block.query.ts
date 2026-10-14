export const CMS_BLOCKS_QUERY = /* GraphQL */ `
  query CmsBlocks($identifiers: [String]) {
    cmsBlocks(identifiers: $identifiers) {
      items {
        identifier
        title
        content
      }
    }
  }
`;
