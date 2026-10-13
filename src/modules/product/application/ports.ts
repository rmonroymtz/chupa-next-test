import type {
  MagentoProduct,
  ProductCard,
  ScrapedProduct,
  ScrapedVariants,
} from '@/modules/product/domain/product';

/**
 * Result of looking a url up in Magento `route()` with the product fields.
 * CMS pages and categories are reported (not treated as missing) so the
 * catch-all page can dispatch them without a second round-trip.
 */
export type MagentoProductLookup =
  | { readonly kind: 'product'; readonly product: MagentoProduct }
  | { readonly kind: 'redirect'; readonly relativeUrl: string; readonly code: number }
  | { readonly kind: 'cms'; readonly identifier: string; readonly relativeUrl: string }
  | { readonly kind: 'category'; readonly uid: string; readonly relativeUrl: string }
  | { readonly kind: 'not_found' };

export interface MagentoProductRepository {
  /**
   * Looks a product up by route url (no leading slash, literal `|`). Rejects
   * when Magento fails, so an outage is never reported as `not_found`.
   */
  findByRouteUrl(routeUrl: string): Promise<MagentoProductLookup>;
}

export interface ProductListRepository {
  /**
   * Products by Magento url key, in the requested order; keys Magento does
   * not find are skipped. `products(filter: {url_key: {in}})` does not match
   * url keys containing `|` (verified live), so those are skipped too, as in
   * the legacy storefront. Rejects when Magento fails.
   */
  findByUrlKeys(urlKeys: readonly string[]): Promise<ProductCard[]>;
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
