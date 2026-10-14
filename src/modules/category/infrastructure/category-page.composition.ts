import 'server-only';
import { cache } from 'react';
import {
  resolveCategoryPage,
  type CategoryPageResolution,
} from '@/modules/category/application/category-page';
import type { Category } from '@/modules/category/domain/category';
import { createMagentoCategoryProductsRepository } from '@/modules/category/infrastructure/magento-category-products-repository';
import { createMagentoCategoryRepository } from '@/modules/category/infrastructure/magento-category-repository';
import { buildCanonicalUrl } from '@/modules/product/domain/product-url';
import { getStoreConfig } from '@/modules/store-config/infrastructure/magento-store-config-repository';
import { getServerEnv } from '@/shared/config/env';
import { getMagentoClient } from '@/shared/graphql/client';

/**
 * Category for the current request. React `cache()` deduplicates the Magento
 * call within one request only. Rejects when Magento fails (5xx, never 404).
 */
const getCategory = cache((uid: string): Promise<Category | null> =>
  createMagentoCategoryRepository(getMagentoClient()).findByUid(uid),
);

/**
 * How the requested category page is served (404, redirect to the clean url,
 * or the category with the requested page of products). Cached per request,
 * so `generateMetadata` and the page share one decision; the page size comes
 * from the per-request cached store config and nothing is shared across
 * requests.
 */
export const getCategoryPage = cache(
  (uid: string, search: string): Promise<CategoryPageResolution> =>
    resolveCategoryPage(
      { uid, search },
      {
        categories: { findByUid: getCategory },
        products: createMagentoCategoryProductsRepository(getMagentoClient()),
        getPageSize: async () => (await getStoreConfig()).gridPerPage,
      },
    ),
);

/** Canonical url (clean category url, no page or query) from a page's canonical path. */
export function getCategoryCanonicalUrl(canonicalPath: string): string {
  return buildCanonicalUrl(getServerEnv().PUBLIC_BASE_URL, canonicalPath);
}
