import type {
  MagentoProduct,
  ScrapedProduct,
  ScrapedVariants,
} from '@/modules/product/domain/product';

/** Result of looking a product up in Magento by its route url. */
export type MagentoProductLookup =
  | { readonly kind: 'product'; readonly product: MagentoProduct }
  | { readonly kind: 'redirect'; readonly relativeUrl: string; readonly code: number }
  | { readonly kind: 'not_found' };

export interface MagentoProductRepository {
  /**
   * Looks a product up by route url (no leading slash, literal `|`). Rejects
   * when Magento fails, so an outage is never reported as `not_found`.
   */
  findByRouteUrl(routeUrl: string): Promise<MagentoProductLookup>;
}

export type ScraperErrorReason = 'timeout' | 'http' | 'invalid_response';

export type ScraperResult<T> =
  | { readonly status: 'found'; readonly product: T }
  | { readonly status: 'not_found' }
  | { readonly status: 'error'; readonly reason: ScraperErrorReason };

export interface ScrapedProductQuery {
  readonly sku: string;
  /** Vendor store, e.g. `ebay`. */
  readonly store: string;
  /** From `resolveEngineId`. */
  readonly engineId: string;
}

export interface ScrapedProductGateway {
  /** Never rejects: every failure is an `error` result. */
  getProduct(query: ScrapedProductQuery): Promise<ScraperResult<ScrapedProduct>>;
  /** Never rejects: every failure is an `error` result. */
  getVariants(query: ScrapedProductQuery): Promise<ScraperResult<ScrapedVariants>>;
}

export interface ProductCopyTrigger {
  /**
   * Asks Magento to create its copy of a vendor product (`processSku`).
   * Fire-and-forget: never rejects; failures are only logged and counted.
   */
  trigger(input: { readonly sku: string; readonly vendor: string }): Promise<void>;
}
