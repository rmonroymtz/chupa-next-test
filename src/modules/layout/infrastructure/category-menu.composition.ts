import 'server-only';
import { cache } from 'react';
import { loadCategoryMenu } from '@/modules/layout/application/load-category-menu';
import { createMagentoCategoryTreeRepository } from '@/modules/layout/infrastructure/magento-category-tree-repository';
import { getServerEnv } from '@/shared/config/env';
import { getMagentoClient } from '@/shared/graphql/client';
import { getLogger } from '@/shared/observability/logger';

/**
 * Header menu for the current request, fetched per request (no data cache).
 * React `cache()` shares one Magento call between the desktop and mobile
 * navigation of a single render. Never rejects: failures yield no items.
 */
export const getCategoryMenu = cache(() =>
  loadCategoryMenu({
    categories: {
      // Built lazily so configuration errors also degrade to an empty menu.
      getTree: () =>
        createMagentoCategoryTreeRepository(getMagentoClient(), {
          timeoutMs: getServerEnv().MAGENTO_MENU_TIMEOUT_MS,
        }).getTree(),
    },
    logger: getLogger().child({ component: 'layout' }),
  }),
);
