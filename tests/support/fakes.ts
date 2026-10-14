/**
 * In-memory adapters for the application ports, for integration tests that
 * must not reach Magento or the scraper API.
 */
import type {
  CategoryProductsQuery,
  CategoryProductsRepository,
  CategoryProductsResult,
  CategoryRepository,
} from '@/modules/category/application/ports';
import type { Category } from '@/modules/category/domain/category';
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
  ProductCard,
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
    /** Non-product lookups (redirect, cms, category) keyed by route url. */
    private readonly lookups: Readonly<Record<string, MagentoProductLookup>> = {},
  ) {}

  async findByRouteUrl(routeUrl: string): Promise<MagentoProductLookup> {
    this.calls.push(routeUrl);
    if (this.failing.has(routeUrl)) throw magentoOutage('ProductByRoute');
    const product = this.products[routeUrl];
    if (product) return { kind: 'product', product };
    return this.lookups[routeUrl] ?? { kind: 'not_found' };
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
  cmsHomePage: 'venia-new-home',
  gridPerPage: 12,
  engineRouting: {
    engineSettings: { amazon: 'direct', ebay: 'api', acme: 'direct', target: 'direct' },
    serviceFallback: { amazon: 'amazon', ebay: 'ebay', acme: 'acme', target: 'target' },
  },
};

export class FakeStoreConfigRepository implements StoreConfigRepository {
  calls = 0;
  constructor(
    private readonly config: StoreConfig = FAKE_STORE_CONFIG,
    private readonly failing = false,
  ) {}

  async get(): Promise<StoreConfig> {
    this.calls += 1;
    if (this.failing) throw magentoOutage('StoreConfig');
    return this.config;
  }
}

export const FAKE_CATEGORY: Category = {
  uid: 'MTI=',
  name: 'Laptops',
  description: '<p>Las mejores <strong>laptops</strong> al mejor precio.</p>',
  urlPath: 'electronica/computacion/laptops',
  urlSuffix: '.html',
  url: '/electronica/computacion/laptops.html',
  metaTitle: 'Laptops | Chupaprecios',
  metaDescription: 'Compra laptops importadas con envío a todo México.',
  breadcrumbs: [
    { uid: 'Mw==', name: 'Electrónica', url: '/electronica.html' },
    { uid: 'NQ==', name: 'Computación', url: '/electronica/computacion.html' },
  ],
};

export class FakeCategoryRepository implements CategoryRepository {
  readonly calls: string[] = [];
  constructor(
    private readonly categories: Readonly<Record<string, Category>> = {},
    private readonly failing: ReadonlySet<string> = new Set(),
  ) {}

  async findByUid(uid: string): Promise<Category | null> {
    this.calls.push(uid);
    if (this.failing.has(uid)) throw magentoOutage('CategoryByUid');
    return this.categories[uid] ?? null;
  }
}

/**
 * Paginates the products listed per category uid like Magento: zero pages for
 * an empty category, and `out_of_range` for a page beyond the last one.
 */
export class FakeCategoryProductsRepository implements CategoryProductsRepository {
  readonly calls: CategoryProductsQuery[] = [];
  constructor(
    private readonly products: Readonly<Record<string, readonly ProductCard[]>> = {},
    private readonly failing: ReadonlySet<string> = new Set(),
  ) {}

  async findPage(query: CategoryProductsQuery): Promise<CategoryProductsResult> {
    this.calls.push({ ...query });
    if (this.failing.has(query.categoryUid)) throw magentoOutage('CategoryProducts');
    const all = this.products[query.categoryUid] ?? [];
    const totalPages = Math.ceil(all.length / query.pageSize);
    if (all.length > 0 && query.currentPage > totalPages) return { kind: 'out_of_range' };
    const start = (query.currentPage - 1) * query.pageSize;
    return {
      kind: 'page',
      page: {
        items: all.slice(start, start + query.pageSize),
        currentPage: query.currentPage,
        pageSize: query.pageSize,
        totalPages,
        totalCount: all.length,
      },
    };
  }
}
