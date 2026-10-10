import 'server-only';
import { cache } from 'react';
import { createBotDetector, type BotDetector } from '@/modules/bot-detection/bot-detector';
import type { ProductCopyTrigger } from '@/modules/product/application/ports';
import {
  createProductPageService,
  type ProductPageDecision,
  type ProductPageService,
} from '@/modules/product/application/product-page-service';
import {
  createScrapedProductLoader,
  type ScrapedProductLoader,
} from '@/modules/product/application/scraped-product-loader';
import { getChapiGateway } from '@/modules/product/infrastructure/chapi-gateway';
import { getMagentoCopyTrigger } from '@/modules/product/infrastructure/magento-copy-trigger';
import { getMagentoProductRepository } from '@/modules/product/infrastructure/magento-product-repository';
import { getStoreConfig } from '@/modules/store-config/infrastructure/magento-store-config-repository';
import { getServerEnv } from '@/shared/config/env';
import { defaultObservability } from '@/shared/http/observability';

/** Composition root for the catch-all page: wires ports to Magento and CHAPI. */

let service: ProductPageService | undefined;
let loader: ScrapedProductLoader | undefined;
let botDetector: BotDetector | undefined;

function getProductPageService(): ProductPageService {
  if (!service) {
    const env = getServerEnv();
    service = createProductPageService({
      products: getMagentoProductRepository(),
      vendors: env.PRODUCT_VENDORS,
      publicBaseUrl: env.PUBLIC_BASE_URL,
      ...defaultObservability('pdp'),
    });
  }
  return service;
}

export function isBotUserAgent(userAgent: string | null): boolean {
  botDetector ??= createBotDetector(getServerEnv().BOT_USER_AGENTS);
  return botDetector(userAgent);
}

/**
 * Page decision for the current request. React `cache()` deduplicates the
 * Magento lookup between `generateMetadata` and the page within one request
 * only; nothing is shared across requests.
 */
export const resolveProductPage = cache(
  (pathname: string, search: string, userAgent: string | null): Promise<ProductPageDecision> =>
    getProductPageService().resolve({
      pathname,
      searchParams: new URLSearchParams(search),
      isBot: isBotUserAgent(userAgent),
    }),
);

export function getScrapedProductLoader(): ScrapedProductLoader {
  loader ??= createScrapedProductLoader({
    gateway: getChapiGateway(),
    // Per-request cached read; a failure becomes an unavailable state.
    storeConfig: { get: getStoreConfig },
    ...defaultObservability('pdp-scraped'),
  });
  return loader;
}

export function getCopyTrigger(): ProductCopyTrigger {
  return getMagentoCopyTrigger();
}
