import 'server-only';
import type { CmsPageRepository } from '@/modules/cms/application/ports';
import { mapCmsPage, type CmsPageDto } from '@/modules/cms/infrastructure/cms-page-mapper';
import { CMS_PAGE_QUERY } from '@/modules/cms/infrastructure/cms-page.query';
import { isMagentoMissingEntity } from '@/modules/cms/infrastructure/magento-missing-entity';
import type { MagentoClient } from '@/shared/graphql/client';

interface CmsPageData {
  cmsPage: CmsPageDto | null;
}

/** Magento-backed repository: no-store, timeout and metrics come from the client. */
export function createMagentoCmsPageRepository(client: MagentoClient): CmsPageRepository {
  return {
    async findByIdentifier(identifier) {
      try {
        const data = await client.request<CmsPageData, { identifier: string }>({
          operationName: 'CmsPage',
          query: CMS_PAGE_QUERY,
          variables: { identifier },
        });
        return mapCmsPage(data.cmsPage, identifier);
      } catch (error) {
        // Magento answers a missing or disabled page with a GraphQL error, not null data.
        if (isMagentoMissingEntity(error)) return null;
        throw error;
      }
    },
  };
}
