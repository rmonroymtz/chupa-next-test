import type { MagentoProductRepository } from '@/modules/product/application/ports';
import type { ScrapedProductOutcome } from '@/modules/product/application/scraped-product-loader';
import { getProductRobots, type ProductRobots } from '@/modules/product/domain/indexability';
import type { MagentoProduct } from '@/modules/product/domain/product';
import {
  buildCanonicalUrl,
  decodeSkuSegment,
  DEFAULT_PRODUCT_URL_SUFFIX,
  matchesProductUrlSku,
  matchSkuSearchUrl,
  parseProductUrl,
  toRouteUrl,
  type SkuSearchUrl,
} from '@/modules/product/domain/product-url';
import { HOME_PATHNAME } from '@/modules/routing/domain/request-path';
import { buildSearchItemUrlKey } from '@/modules/search/domain/search-item-url';
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
  /** Magento category; the category page decides 404, page redirects and indexability. */
  | { readonly kind: 'category'; readonly uid: string; readonly relativeUrl: string }
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
      /**
       * `product_url`: Magento has no product for this product url.
       * `sku_search`: header sku jump (`{vendor}-{sku}-search.html`), never
       * looked up in Magento; once the scraper finds the product, the
       * canonical becomes the product url (`resolveSkuSearchCanonicalUrl`).
       */
      readonly origin: 'product_url' | 'sku_search';
    };

/** The `missing_product` decision. */
export type MissingProductDecision = Extract<ProductPageDecision, { kind: 'missing_product' }>;

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
    // Magento resolves the site root itself: `route(url: "/")` is the configured home page.
    const routeUrl = pathname === HOME_PATHNAME ? HOME_PATHNAME : toRouteUrl(pathname);
    if (routeUrl === null) return { kind: 'not_found', case: null };

    // The url helpers below take the raw pathname and decode it once
    // themselves; `routeUrl` is already decoded and must not be parsed again.
    // The sku jump never asks Magento, which answers a placeholder product for
    // it (decision 7 of phase 3).
    const skuSearch = matchSkuSearchUrl(pathname, { vendors: deps.vendors, suffix });
    if (skuSearch) {
      return skuSearchProduct(pathname, routeUrl, skuSearch, searchParams, isBot);
    }

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
        return { kind: 'category', uid: lookup.uid, relativeUrl: lookup.relativeUrl };
      case 'product':
        if (isPlaceholder(pathname, lookup.product, searchParams)) {
          return missing(pathname, routeUrl, searchParams, isBot);
        }
        return existing(lookup.product, isBot);
      case 'not_found':
        return missing(pathname, routeUrl, searchParams, isBot);
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

  /**
   * Magento `route()` answers a placeholder PRODUCT for any vendor-shaped url
   * it does not have (production `urllocator-external-placeholder`, staging
   * `VA11-GO-NA`). A product whose sku is not the url's sku is that
   * placeholder: the url is treated as missing from Magento. Urls that are not
   * vendor product urls keep whatever Magento answers.
   */
  function isPlaceholder(
    pathname: string,
    product: MagentoProduct,
    searchParams: URLSearchParams,
  ): boolean {
    const matches = matchesProductUrlSku(pathname, product.sku, {
      vendors: deps.vendors,
      suffix,
      searchParams,
    });
    if (matches !== false) return false;
    deps.metrics.emitMetric({ name: 'MagentoPlaceholderIgnored', value: 1 });
    deps.logger.info(
      { path: pathname, magentoSku: product.sku, magentoUrl: product.relativeUrl },
      'magento placeholder ignored',
    );
    return true;
  }

  function missing(
    pathname: string,
    routeUrl: string,
    searchParams: URLSearchParams,
    isBot: boolean,
  ): ProductPageDecision {
    const urlKey = productUrlKey(routeUrl);
    if (urlKey === null) return { kind: 'not_found', case: null };
    if (isBot) return { kind: 'not_found', case: 'missing_bot' };

    const parsed = parseProductUrl(pathname, { vendors: deps.vendors, suffix, searchParams });
    return {
      kind: 'missing_product',
      case: 'missing_user',
      robots: getProductRobots({ existsInMagento: false }),
      canonicalUrl: buildCanonicalUrl(deps.publicBaseUrl, routeUrl),
      lookup: parsed ? { sku: parsed.sku, vendor: parsed.vendor } : null,
      vendor: urlKey.vendor,
      searchUrl: buildSearchUrl(urlKey.words, urlKey.vendor),
      origin: 'product_url',
    };
  }

  /** Same outcomes as a product missing from Magento, without the Magento lookup. */
  function skuSearchProduct(
    pathname: string,
    routeUrl: string,
    { vendor, skuSegment }: SkuSearchUrl,
    searchParams: URLSearchParams,
    isBot: boolean,
  ): ProductPageDecision {
    if (isBot) return { kind: 'not_found', case: 'missing_bot' };

    const parsed = parseProductUrl(pathname, { vendors: deps.vendors, suffix, searchParams });
    const typedSku = decodeSkuSegment(skuSegment, vendor) ?? '';
    return {
      kind: 'missing_product',
      case: 'missing_user',
      robots: getProductRobots({ existsInMagento: false }),
      canonicalUrl: buildCanonicalUrl(deps.publicBaseUrl, routeUrl),
      lookup: parsed ? { sku: parsed.sku, vendor: parsed.vendor } : null,
      vendor,
      searchUrl: buildSkuSearchUrl(typedSku, vendor),
      origin: 'sku_search',
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
    const pdpCase = 'case' in decision ? decision.case : null;
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

/** Search for the typed sku; without a usable sku, the store's search page. */
function buildSkuSearchUrl(sku: string, vendor: string): string {
  const query = new URLSearchParams(sku === '' ? { store: vendor } : { query: sku, store: vendor });
  return `${SEARCH_PATH}?${query.toString()}`;
}

/**
 * Canonical url of a sku search page: once the scraper found the product, the
 * product url search results link to (`/{vendor}-{sku}-{slug}.html`, same
 * builder as search items); otherwise, or when the title gives no slug, the
 * decision's own canonical url.
 */
export function resolveSkuSearchCanonicalUrl(
  publicBaseUrl: string,
  decision: MissingProductDecision,
  outcome: ScrapedProductOutcome,
  suffix: string = DEFAULT_PRODUCT_URL_SUFFIX,
): string {
  if (outcome.kind !== 'found') return decision.canonicalUrl;
  const { product } = outcome;
  // The slug keeps only the ascii letters and digits of the title.
  if (!/[a-z0-9]/i.test(product.title)) return decision.canonicalUrl;
  const urlKey = buildSearchItemUrlKey(decision.vendor, product.sku, product.title);
  return buildCanonicalUrl(publicBaseUrl, `${urlKey}${suffix}`);
}

function buildSearchUrl(words: readonly string[], vendor: string): string {
  const query = new URLSearchParams({ query: words.join(' '), store: vendor });
  return `${SEARCH_PATH}?${query.toString()}`;
}
