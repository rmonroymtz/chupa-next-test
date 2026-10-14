import 'server-only';
import type { CmsBlockRepository } from '@/modules/cms/application/ports';
import { mapCmsBlock, type CmsBlockDto } from '@/modules/cms/infrastructure/cms-block-mapper';
import { CMS_BLOCKS_QUERY } from '@/modules/cms/infrastructure/cms-block.query';
import { isMagentoMissingEntity } from '@/modules/cms/infrastructure/magento-missing-entity';
import { MagentoRequestError, type MagentoClient } from '@/shared/graphql/client';

interface CmsBlocksData {
  cmsBlocks: { items?: Array<CmsBlockDto | null> | null } | null;
}

/** Magento-backed repository: no-store, timeout and metrics come from the client. */
export function createMagentoCmsBlockRepository(client: MagentoClient): CmsBlockRepository {
  return {
    async findByIdentifier(identifier) {
      let data: CmsBlocksData;
      try {
        data = await client.request<CmsBlocksData, { identifiers: string[] }>({
          operationName: 'CmsBlocks',
          query: CMS_BLOCKS_QUERY,
          variables: { identifiers: [identifier] },
        });
      } catch (error) {
        // Magento answers a missing or disabled block with a GraphQL error.
        if (isMagentoMissingEntity(error)) return null;
        throw error;
      }
      const items = data.cmsBlocks?.items;
      if (!Array.isArray(items)) {
        throw new MagentoRequestError({
          kind: 'invalid_response',
          operation: 'CmsBlocks',
          message: 'Magento returned no cmsBlocks items',
        });
      }
      // One identifier asked; Magento may also omit it from the items.
      return items.map(mapCmsBlock).find((block) => block !== null) ?? null;
    },
  };
}
