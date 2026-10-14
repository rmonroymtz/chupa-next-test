import 'server-only';
import { cache } from 'react';
import type { CmsBlock } from '@/modules/cms/domain/cms-block';
import { createMagentoCmsBlockRepository } from '@/modules/cms/infrastructure/magento-cms-block-repository';
import { getMagentoClient } from '@/shared/graphql/client';

/**
 * CMS block for the current request. React `cache()` deduplicates the Magento
 * call when a page renders the same block twice within one request only;
 * nothing is shared across requests. Rejects when Magento fails.
 */
export const getCmsBlock = cache((identifier: string): Promise<CmsBlock | null> =>
  createMagentoCmsBlockRepository(getMagentoClient()).findByIdentifier(identifier),
);
