import 'server-only';
import { cache } from 'react';
import {
  cmsCanonicalPath,
  resolveCmsPageRoute,
  type CmsPageRoute,
  type ServedCmsPageRoute,
} from '@/modules/cms/application/home-page';
import type { CmsPage } from '@/modules/cms/domain/cms-page';
import { createMagentoCmsPageRepository } from '@/modules/cms/infrastructure/magento-cms-page-repository';
import { buildCanonicalUrl } from '@/modules/product/domain/product-url';
import { getStoreConfig } from '@/modules/store-config/infrastructure/magento-store-config-repository';
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

/**
 * How the requested CMS page is served (home, redirect to the home, or a
 * regular page). The home identifier comes from the per-request cached store
 * config; nothing is shared across requests.
 */
export const getCmsPageRoute = cache(
  (pathname: string, search: string, identifier: string): Promise<CmsPageRoute> =>
    resolveCmsPageRoute(
      { pathname, search, identifier },
      { getHomeIdentifier: async () => (await getStoreConfig()).cmsHomePage },
    ),
);

/**
 * Canonical url (literal path, no query): the site root for the home,
 * Magento's relative url for any other page.
 */
export function getCmsCanonicalUrl(page: CmsPage, route: ServedCmsPageRoute): string {
  return buildCanonicalUrl(getServerEnv().PUBLIC_BASE_URL, cmsCanonicalPath(page, route));
}
