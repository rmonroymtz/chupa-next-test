import 'server-only';
import { cache } from 'react';
import type { CmsPage } from '@/modules/cms/domain/cms-page';
import { createMagentoCmsPageRepository } from '@/modules/cms/infrastructure/magento-cms-page-repository';
import { buildCanonicalUrl } from '@/modules/product/domain/product-url';
import { getServerEnv } from '@/shared/config/env';
import { getMagentoClient } from '@/shared/graphql/client';

/**
 * CMS page for the current request. React `cache()` deduplicates the Magento
 * call between `generateMetadata` and the page within one request only.
 * Rejects when Magento fails (rendered as 5xx, never 404).
 */
export const getCmsPage = cache((identifier: string): Promise<CmsPage | null> =>
  createMagentoCmsPageRepository(getMagentoClient()).findByIdentifier(identifier),
);

/** Canonical url from Magento's relative url (literal path, no query). */
export function getCmsCanonicalUrl(page: CmsPage): string {
  return buildCanonicalUrl(getServerEnv().PUBLIC_BASE_URL, page.relativeUrl);
}
