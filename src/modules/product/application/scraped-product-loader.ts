import type { ScrapedProductGateway } from '@/modules/product/application/ports';
import type {
  PageLogger,
  VendorProductRef,
} from '@/modules/product/application/product-page-service';
import type { ScrapedProduct } from '@/modules/product/domain/product';
import type { StoreConfigRepository } from '@/modules/store-config/application/ports';
import { resolveEngineId } from '@/modules/store-config/domain/store-config';
import type { MetricsEmitter } from '@/shared/observability/metrics';

export type UnavailableReason =
  'unparsable_url' | 'store_config_error' | 'no_engine' | 'not_found' | 'error';

export type ScrapedProductOutcome =
  | {
      readonly kind: 'found';
      readonly product: ScrapedProduct;
      /** Copy request to fire after the response. */
      readonly copyRequest: VendorProductRef;
    }
  | { readonly kind: 'unavailable'; readonly reason: UnavailableReason };

export interface ScrapedProductLoaderDeps {
  readonly gateway: ScrapedProductGateway;
  readonly storeConfig: StoreConfigRepository;
  readonly logger: PageLogger & { warn(context: Record<string, unknown>, message: string): void };
  readonly metrics: MetricsEmitter;
}

export interface ScrapedProductLoader {
  /** Never rejects: every failure is an `unavailable` outcome. */
  load(ref: VendorProductRef | null): Promise<ScrapedProductOutcome>;
}

/**
 * Loads a product Magento does not have yet from the scraper API, for the
 * streamed part of a `missing_user` page. It never rejects, so the page shell
 * that was already sent can always finish with a product or an unavailable
 * state.
 */
export function createScrapedProductLoader(deps: ScrapedProductLoaderDeps): ScrapedProductLoader {
  async function attempt(ref: VendorProductRef | null): Promise<ScrapedProductOutcome> {
    if (ref === null) return unavailable('unparsable_url');

    let engineId: string | null;
    try {
      engineId = resolveEngineId(ref.vendor, (await deps.storeConfig.get()).engineRouting);
    } catch (error) {
      deps.logger.warn({ ...ref, err: error }, 'store config unavailable for scraper lookup');
      return unavailable('store_config_error');
    }
    if (engineId === null) return unavailable('no_engine');

    const result = await deps.gateway.getProduct({ sku: ref.sku, store: ref.vendor, engineId });
    if (result.status === 'found') {
      return { kind: 'found', product: result.product, copyRequest: ref };
    }
    return unavailable(result.status);
  }

  return {
    async load(ref) {
      let outcome: ScrapedProductOutcome;
      try {
        outcome = await attempt(ref);
      } catch (error) {
        deps.logger.warn({ ...ref, err: error }, 'scraper lookup failed unexpectedly');
        outcome = unavailable('error');
      }
      const label = outcome.kind === 'found' ? 'found' : outcome.reason;
      deps.metrics.emitMetric({
        name: 'PdpScrapedOutcome',
        value: 1,
        dimensions: { Outcome: label },
      });
      deps.logger.info({ ...ref, outcome: label }, 'scraped product lookup');
      return outcome;
    },
  };
}

function unavailable(reason: UnavailableReason): ScrapedProductOutcome {
  return { kind: 'unavailable', reason };
}
