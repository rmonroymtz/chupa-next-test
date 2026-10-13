import 'server-only';
import {
  createPageBuilderLoader,
  type PageBuilderLoader,
} from '@/modules/page-builder/application/page-builder-loader';
import { getMagentoProductListRepository } from '@/modules/product/infrastructure/magento-product-list-repository';
import { getStoreConfig } from '@/modules/store-config/infrastructure/magento-store-config-repository';
import { defaultObservability } from '@/shared/http/observability';
import type { Logger } from 'pino';

/** Composition root for Page Builder content: store config, products and logging. */

let loader: PageBuilderLoader | undefined;
let logger: Logger | undefined;

export function getPageBuilderLogger(): Logger {
  logger ??= defaultObservability('page-builder').logger;
  return logger;
}

export function getPageBuilderLoader(): PageBuilderLoader {
  loader ??= createPageBuilderLoader({
    // Per-request cached read (React `cache()`), shared with the rest of the render.
    storeConfig: {
      get: async () => {
        const config = await getStoreConfig();
        return { productUrlSuffix: config.productUrlSuffix, baseMediaUrl: config.baseMediaUrl };
      },
    },
    products: getMagentoProductListRepository(),
    logger: getPageBuilderLogger(),
  });
  return loader;
}
