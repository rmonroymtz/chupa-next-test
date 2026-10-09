/**
 * In-memory adapters for the application ports, for integration tests that
 * must not reach Magento or the scraper API.
 */
import type {
  MagentoProductLookup,
  MagentoProductRepository,
  ProductCopyTrigger,
  ScrapedProductGateway,
  ScrapedProductQuery,
  ScraperResult,
} from '@/modules/product/application/ports';
import type {
  MagentoProduct,
  ScrapedProduct,
  ScrapedVariants,
} from '@/modules/product/domain/product';
import type { RouteResolver } from '@/modules/routing/application/ports';
import type { RouteResolution } from '@/modules/routing/domain/route';
import type { StoreConfigRepository } from '@/modules/store-config/application/ports';
import type { StoreConfig } from '@/modules/store-config/domain/store-config';
import { MagentoRequestError } from '@/shared/graphql/client';

/** Error thrown by the fakes for route urls listed in `failing` (a Magento outage). */
function magentoOutage(operation: string): MagentoRequestError {
  return new MagentoRequestError({ kind: 'http', operation, status: 503, message: 'Fake outage' });
}

export class FakeRouteResolver implements RouteResolver {
  readonly calls: string[] = [];
  constructor(
    private readonly routes: Readonly<Record<string, RouteResolution>> = {},
    private readonly failing: ReadonlySet<string> = new Set(),
  ) {}

  async resolve(routeUrl: string): Promise<RouteResolution> {
    this.calls.push(routeUrl);
    if (this.failing.has(routeUrl)) throw magentoOutage('ResolveURL');
    return this.routes[routeUrl] ?? { kind: 'not_found' };
  }
}

export class FakeMagentoProductRepository implements MagentoProductRepository {
  readonly calls: string[] = [];
  constructor(
    private readonly products: Readonly<Record<string, MagentoProduct>> = {},
    private readonly failing: ReadonlySet<string> = new Set(),
  ) {}

  async findByRouteUrl(routeUrl: string): Promise<MagentoProductLookup> {
    this.calls.push(routeUrl);
    if (this.failing.has(routeUrl)) throw magentoOutage('ProductByRoute');
    const product = this.products[routeUrl];
    return product ? { kind: 'product', product } : { kind: 'not_found' };
  }
}

const gatewayKey = (query: ScrapedProductQuery) => `${query.store}:${query.sku}`;

export class FakeScrapedProductGateway implements ScrapedProductGateway {
  readonly calls: ScrapedProductQuery[] = [];
  constructor(
    private readonly products: Readonly<Record<string, ScraperResult<ScrapedProduct>>> = {},
    private readonly variants: Readonly<Record<string, ScraperResult<ScrapedVariants>>> = {},
  ) {}

  /** Keys are `${store}:${sku}`; unknown keys resolve `not_found`. */
  async getProduct(query: ScrapedProductQuery): Promise<ScraperResult<ScrapedProduct>> {
    this.calls.push(query);
    return this.products[gatewayKey(query)] ?? { status: 'not_found' };
  }

  async getVariants(query: ScrapedProductQuery): Promise<ScraperResult<ScrapedVariants>> {
    this.calls.push(query);
    return this.variants[gatewayKey(query)] ?? { status: 'not_found' };
  }
}

export class FakeProductCopyTrigger implements ProductCopyTrigger {
  readonly calls: { sku: string; vendor: string }[] = [];

  async trigger(input: { sku: string; vendor: string }): Promise<void> {
    this.calls.push({ ...input });
  }
}

export const FAKE_STORE_CONFIG: StoreConfig = {
  storeCode: 'default',
  storeName: 'Chupaprecios',
  locale: 'es_MX',
  productUrlSuffix: '.html',
  baseMediaUrl: 'https://chupaprecios.com.mx/media/',
  baseCurrencyCode: 'USD',
  displayCurrencyCode: 'MXN',
  defaultTitle: 'Chupaprecios | Explora comprar sin fronteras.',
  titlePrefix: null,
  titleSuffix: null,
  titleSeparator: '-',
  defaultDescription: null,
  engineRouting: {
    engineSettings: { amazon: 'direct', ebay: 'api', acme: 'direct', target: 'direct' },
    serviceFallback: { amazon: 'amazon', ebay: 'ebay', acme: 'acme', target: 'target' },
  },
};

export class FakeStoreConfigRepository implements StoreConfigRepository {
  constructor(private readonly config: StoreConfig = FAKE_STORE_CONFIG) {}

  async get(): Promise<StoreConfig> {
    return this.config;
  }
}
