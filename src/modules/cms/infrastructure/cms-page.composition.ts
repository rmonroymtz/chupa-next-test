import 'server-only';
import { cache } from 'react';
import {
  createCmsPageOverrides,
  resolveCmsPageView,
  type CmsPageView,
} from '@/modules/cms/application/cms-page-view';
import type { CmsPage } from '@/modules/cms/domain/cms-page';
import { createMagentoCmsPageRepository } from '@/modules/cms/infrastructure/magento-cms-page-repository';
import { CMS_PAGE_OVERRIDES, type CmsPageOverride } from '@/modules/cms/ui/cms-page-overrides';
import { buildCanonicalUrl } from '@/modules/product/domain/product-url';
import { getStoreConfig } from '@/modules/store-config/infrastructure/magento-store-config-repository';
import { getServerEnv } from '@/shared/config/env';
import { getMagentoClient } from '@/shared/graphql/client';

/**
 * CMS page for the current request. React `cache()` deduplicates the Magento
 * call within one request only. Rejects when Magento fails (5xx, never 404).
 */
const getCmsPage = cache((identifier: string): Promise<CmsPage | null> =>
  createMagentoCmsPageRepository(getMagentoClient()).findByIdentifier(identifier),
);

const overrides = createCmsPageOverrides(CMS_PAGE_OVERRIDES);

/**
 * How the requested CMS page is served (redirect to the home, 404, or the
 * page rendered by its registered Next component or its Magento content).
 * Cached per request, so `generateMetadata` and the page share one decision;
 * the home identifier comes from the per-request cached store config and
 * nothing is shared across requests.
 */
export const getCmsPageView = cache(
  (pathname: string, search: string, identifier: string): Promise<CmsPageView<CmsPageOverride>> =>
    resolveCmsPageView(
      { pathname, search, identifier },
      {
        pages: { findByIdentifier: getCmsPage },
        home: { getHomeIdentifier: async () => (await getStoreConfig()).cmsHomePage },
        overrides,
      },
    ),
);

/** Canonical url (literal path, no query) from a served page's canonical path. */
export function getCmsCanonicalUrl(canonicalPath: string): string {
  return buildCanonicalUrl(getServerEnv().PUBLIC_BASE_URL, canonicalPath);
}
