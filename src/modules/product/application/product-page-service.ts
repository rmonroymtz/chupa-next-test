import type { MagentoProductRepository } from '@/modules/product/application/ports';
import { getProductRobots, type ProductRobots } from '@/modules/product/domain/indexability';
import type { MagentoProduct } from '@/modules/product/domain/product';
import {
  buildCanonicalUrl,
  DEFAULT_PRODUCT_URL_SUFFIX,
  parseProductUrl,
  toRouteUrl,
} from '@/modules/product/domain/product-url';
import type { MetricsEmitter } from '@/shared/observability/metrics';

/** PDP case reported in the `PdpOutcome` metric. */
export type PdpCase = 'exists_user' | 'exists_bot' | 'missing_user' | 'missing_bot';

/** Vendor product reference for `processSku` and the scraper API. */
export interface VendorProductRef {
  readonly sku: string;
  readonly vendor: string;
}

/**
 * What the catch-all page must do for a request. Decided before anything is
 * sent, so redirects and 404s keep their real HTTP status.
 */
export type ProductPageDecision =
  | { readonly kind: 'redirect'; readonly location: string; readonly permanent: boolean }
  | { readonly kind: 'cms'; readonly identifier: string; readonly relativeUrl: string }
  | {
      readonly kind: 'not_found';
      /** Set when the url is a product url (`missing_bot`); null otherwise. */
      readonly case: 'missing_bot' | null;
    }
  | {
      readonly kind: 'magento_product';
      readonly case: 'exists_user' | 'exists_bot';
      readonly product: MagentoProduct;
      readonly robots: ProductRobots;
      readonly canonicalUrl: string;
      /** Copy refresh to fire after the response; null for bots. */
      readonly copyRequest: VendorProductRef | null;
    }
  | {
      readonly kind: 'missing_product';
      readonly case: 'missing_user';
      readonly robots: ProductRobots;
      readonly canonicalUrl: string;
      /** Scraper lookup; null when the sku segment cannot be decoded. */
      readonly lookup: VendorProductRef | null;
      readonly vendor: string;
      /** Legacy search page for alternatives. */
      readonly searchUrl: string;
    };

export interface ProductPageRequest {
  /** Request pathname; may be percent-encoded. */
  readonly pathname: string;
  readonly searchParams: URLSearchParams;
  /** Bot status only gates scraper and mutation calls, never indexability. */
  readonly isBot: boolean;
}

/** Minimal structured logger (pino-compatible). */
export interface PageLogger {
  info(context: Record<string, unknown>, message: string): void;
}

export interface ProductPageServiceDeps {
  readonly products: MagentoProductRepository;
  /** Lowercase vendor allow-list (`PRODUCT_VENDORS`). */
  readonly vendors: readonly string[];
  /** Origin used for canonical urls (`PUBLIC_BASE_URL`). */
  readonly publicBaseUrl: string;
  readonly suffix?: string;
  readonly logger: PageLogger;
  readonly metrics: MetricsEmitter;
}

export interface ProductPageService {
  /** Rejects when Magento fails, so an outage is never rendered as a 404. */
  resolve(request: ProductPageRequest): Promise<ProductPageDecision>;
}

const SEARCH_PATH = '/search.html';

/**
 * Decides how the catch-all route renders a url, from one Magento `route()`
 * lookup. Indexability depends only on whether Magento has the product (the
 * same answer for every visitor); bot status only decides whether the scraper
 * API and the copy mutation may run.
 */
export function createProductPageService(deps: ProductPageServiceDeps): ProductPageService {
  const suffix = deps.suffix ?? DEFAULT_PRODUCT_URL_SUFFIX;

  async function decide({
    pathname,
    searchParams,
    isBot,
  }: ProductPageRequest): Promise<ProductPageDecision> {
    const routeUrl = toRouteUrl(pathname);
    if (routeUrl === null) return { kind: 'not_found', case: null };

    const lookup = await deps.products.findByRouteUrl(routeUrl);
    switch (lookup.kind) {
      case 'redirect':
        return {
          kind: 'redirect',
          location: toLocation(lookup.relativeUrl),
          permanent: lookup.code === 301 || lookup.code === 308,
        };
      case 'cms':
        return { kind: 'cms', identifier: lookup.identifier, relativeUrl: lookup.relativeUrl };
      case 'category':
        // Phase 1 serves no category pages; PWA Studio keeps them.
        return { kind: 'not_found', case: null };
      case 'product':
        return existing(lookup.product, isBot);
      case 'not_found':
        return missing(routeUrl, searchParams, isBot);
    }
  }

  function existing(product: MagentoProduct, isBot: boolean): ProductPageDecision {
    // Legacy parity: vendor and sku come from splitting the Magento url key.
    const parsed = parseProductUrl(product.relativeUrl, { vendors: deps.vendors, suffix });
    return {
      kind: 'magento_product',
      case: isBot ? 'exists_bot' : 'exists_user',
      product,
      robots: getProductRobots({ existsInMagento: true }),
      canonicalUrl: buildCanonicalUrl(deps.publicBaseUrl, product.relativeUrl),
      copyRequest: !isBot && parsed ? { sku: parsed.sku, vendor: parsed.vendor } : null,
    };
  }

  function missing(
    routeUrl: string,
    searchParams: URLSearchParams,
    isBot: boolean,
  ): ProductPageDecision {
    const urlKey = productUrlKey(routeUrl);
    if (urlKey === null) return { kind: 'not_found', case: null };
    if (isBot) return { kind: 'not_found', case: 'missing_bot' };

    const parsed = parseProductUrl(routeUrl, { vendors: deps.vendors, suffix, searchParams });
    return {
      kind: 'missing_product',
      case: 'missing_user',
      robots: getProductRobots({ existsInMagento: false }),
      canonicalUrl: buildCanonicalUrl(deps.publicBaseUrl, routeUrl),
      lookup: parsed ? { sku: parsed.sku, vendor: parsed.vendor } : null,
      vendor: urlKey.vendor,
      searchUrl: buildSearchUrl(urlKey.words, urlKey.vendor),
    };
  }

  /** Vendor and slug words of a product-shaped url (`{vendor}-{sku}-{slug}{suffix}`). */
  function productUrlKey(routeUrl: string): { vendor: string; words: string[] } | null {
    if (!routeUrl.endsWith(suffix)) return null;
    const urlKey = routeUrl.slice(0, routeUrl.length - suffix.length);
    if (urlKey.includes('/')) return null;
    const [vendorSegment = '', , ...words] = urlKey.split('-');
    const vendor = vendorSegment.toLowerCase();
    if (!deps.vendors.includes(vendor)) return null;
    return { vendor, words: words.filter((word) => word !== '') };
  }

  function record(decision: ProductPageDecision, request: ProductPageRequest): void {
    if (request.isBot) {
      deps.metrics.emitMetric({
        name: 'BotRequest',
        value: 1,
        dimensions: { Page: page(decision) },
      });
    }
    const pdpCase = decision.kind === 'redirect' || decision.kind === 'cms' ? null : decision.case;
    if (pdpCase) {
      deps.metrics.emitMetric({ name: 'PdpOutcome', value: 1, dimensions: { Case: pdpCase } });
    }
    deps.logger.info(
      { path: request.pathname, decision: decision.kind, case: pdpCase, bot: request.isBot },
      'page decision',
    );
  }

  return {
    async resolve(request) {
      const decision = await decide(request);
      record(decision, request);
      return decision;
    },
  };
}

function page(decision: ProductPageDecision): string {
  switch (decision.kind) {
    case 'magento_product':
    case 'missing_product':
      return 'product';
    case 'not_found':
      return decision.case ? 'product' : 'not_found';
    default:
      return decision.kind;
  }
}

/** Site-relative location for a Magento redirect target (absolute urls kept). */
function toLocation(relativeUrl: string): string {
  if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;
  return `/${relativeUrl.replace(/^\/+/, '')}`;
}

function buildSearchUrl(words: readonly string[], vendor: string): string {
  const query = new URLSearchParams({ query: words.join(' '), store: vendor });
  return `${SEARCH_PATH}?${query.toString()}`;
}
