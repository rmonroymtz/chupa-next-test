import { describe, expect, it } from 'vitest';
import type { MagentoProduct } from '@/modules/product/domain/product';
import {
  createProductPageService,
  resolveSkuSearchCanonicalUrl,
  type ProductPageDecision,
} from '@/modules/product/application/product-page-service';
import { parseSearchProductResult } from '@/modules/product/infrastructure/chapi-mapper';
import {
  mapProductRoute,
  type ProductRouteDto,
} from '@/modules/product/infrastructure/magento-product-mapper';
import { MagentoRequestError } from '@/shared/graphql/client';
import { FakeMagentoProductRepository } from '../../../../support/fakes';
import { createCapturingObservability } from '../../../../support/observability';
import fixture from '../../../../fixtures/magento/product-by-route.simple.json';
import amazonFound from '../../../../fixtures/chapi/product.amazon.synthetic.json';

const EXISTING_URL = fixture.data.route.relative_url;
const lookup = mapProductRoute(fixture.data.route as ProductRouteDto, EXISTING_URL);
const PRODUCT = (lookup.kind === 'product' ? lookup.product : null) as MagentoProduct;
const BASE = 'https://chupaprecios.com.mx';
const VENDORS = ['amazon', 'ebay', 'target', 'acme'];

function setup(options: { failing?: string[] } = {}) {
  const repository = new FakeMagentoProductRepository(
    { [EXISTING_URL]: PRODUCT },
    new Set(options.failing ?? []),
    {
      'old-shirt.html': { kind: 'redirect', relativeUrl: 'new-shirt.html', code: 301 },
      'sale.html': { kind: 'redirect', relativeUrl: '/promos.html', code: 302 },
      'about-us': { kind: 'cms', identifier: 'about-us', relativeUrl: 'about-us' },
      '/': { kind: 'cms', identifier: 'venia-new-home', relativeUrl: 'venia-new-home' },
      'men.html': { kind: 'category', uid: 'MTI=', relativeUrl: 'men.html' },
    },
  );
  const observability = createCapturingObservability();
  const service = createProductPageService({
    products: repository,
    vendors: VENDORS,
    publicBaseUrl: BASE,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  const resolve = (pathname: string, isBot: boolean, search = '') =>
    service.resolve({ pathname, searchParams: new URLSearchParams(search), isBot });
  return { repository, observability, resolve };
}

const MISSING_PATH = '/ebay-405512345678-apple-iphone-15-pro-128gb.html';

describe('product page service', () => {
  describe('product exists in Magento', () => {
    it.each([
      [false, 'exists_user'],
      [true, 'exists_bot'],
    ] as const)('renders it indexable for every visitor (bot=%s)', async (isBot, pdpCase) => {
      const { resolve } = setup();

      const decision = await resolve(`/${EXISTING_URL}`, isBot);

      expect(decision).toMatchObject({
        kind: 'magento_product',
        case: pdpCase,
        product: PRODUCT,
        robots: { index: true, follow: true },
        canonicalUrl: `${BASE}/${EXISTING_URL}`,
      });
    });

    it('asks for a copy refresh with vendor and sku parsed from the Magento url (users only)', async () => {
      const { resolve } = setup();

      const user = await resolve(`/${EXISTING_URL}`, false);
      const bot = await resolve(`/${EXISTING_URL}`, true);

      expect(user.kind === 'magento_product' && user.copyRequest).toEqual({
        sku: '126981644035|428130345038',
        vendor: 'ebay',
      });
      expect(bot.kind === 'magento_product' && bot.copyRequest).toBeNull();
    });

    it('resolves an encoded | in the request path to the same Magento url', async () => {
      const { resolve, repository } = setup();

      const decision = await resolve(`/${EXISTING_URL.replace('|', '%7C')}`, false);

      expect(decision.kind).toBe('magento_product');
      expect(repository.calls).toEqual([EXISTING_URL]);
    });

    it('does not ask for a copy when the Magento url is not a vendor product url', async () => {
      const repository = new FakeMagentoProductRepository({
        'house-brand-mug.html': { ...PRODUCT, relativeUrl: 'house-brand-mug.html' },
      });
      const { logger, metrics } = createCapturingObservability();
      const service = createProductPageService({
        products: repository,
        vendors: VENDORS,
        publicBaseUrl: BASE,
        logger,
        metrics,
      });

      const decision = await service.resolve({
        pathname: '/house-brand-mug.html',
        searchParams: new URLSearchParams(),
        isBot: false,
      });

      expect(decision.kind === 'magento_product' && decision.copyRequest).toBeNull();
    });
  });

  describe('product missing from Magento', () => {
    it('is a 404 for bots, without scraper lookup data', async () => {
      const { resolve } = setup();

      expect(await resolve(MISSING_PATH, true)).toEqual({ kind: 'not_found', case: 'missing_bot' });
    });

    it('renders a noindex page for users with the scraper lookup', async () => {
      const { resolve } = setup();

      const decision = await resolve(MISSING_PATH, false);

      expect(decision).toEqual({
        kind: 'missing_product',
        case: 'missing_user',
        robots: { index: false, follow: true },
        canonicalUrl: `${BASE}/ebay-405512345678-apple-iphone-15-pro-128gb.html`,
        lookup: { sku: '405512345678', vendor: 'ebay' },
        vendor: 'ebay',
        searchUrl: '/search.html?query=apple+iphone+15+pro+128gb&store=ebay',
        origin: 'product_url',
      });
    });

    it('applies the eBay ?var= variant to the scraper sku', async () => {
      const { resolve } = setup();

      const decision = await resolve(MISSING_PATH, false, 'var=999');

      expect(decision.kind === 'missing_product' && decision.lookup).toEqual({
        sku: '405512345678|999',
        vendor: 'ebay',
      });
    });

    it('keeps the unavailable state (no lookup) for a vendor url with an undecodable sku', async () => {
      const { resolve } = setup();

      const decision = await resolve('/acme-***-broken.html', false);

      expect(decision).toMatchObject({
        kind: 'missing_product',
        lookup: null,
        vendor: 'acme',
        searchUrl: '/search.html?query=broken&store=acme',
      });
    });

    it.each(['/foo', '/some/nested/page.html', '/walmart-1-x.html', '/favicon.ico'])(
      'is a 404 for everyone when %s is not a product url',
      async (pathname) => {
        const { resolve } = setup();

        expect(await resolve(pathname, false)).toEqual({ kind: 'not_found', case: null });
        expect(await resolve(pathname, true)).toEqual({ kind: 'not_found', case: null });
      },
    );

    it('is a 404 without asking Magento when the path cannot be a route url', async () => {
      const { resolve, repository } = setup();

      expect(await resolve('/%E0%A4%A', false)).toEqual({ kind: 'not_found', case: null });
      expect(repository.calls).toEqual([]);
    });
  });

  describe('sku search jump /{vendor}-{sku}-search.html', () => {
    const SKU_SEARCH = '/amazon-B00IJ0ALYS-search.html';

    function withPlaceholder() {
      // Staging Magento answers a placeholder product for every `*-search.html` url.
      const placeholder = { ...PRODUCT, sku: 'VA11-GO-NA', name: 'Carmina Earrings' };
      const repository = new FakeMagentoProductRepository({
        'amazon-B00IJ0ALYS-search.html': placeholder,
        'ebay-405512345678-search.html': placeholder,
        'amazon--search.html': placeholder,
      });
      const observability = createCapturingObservability();
      const service = createProductPageService({
        products: repository,
        vendors: VENDORS,
        publicBaseUrl: BASE,
        logger: observability.logger,
        metrics: observability.metrics,
      });
      const resolve = (pathname: string, isBot: boolean, search = '') =>
        service.resolve({ pathname, searchParams: new URLSearchParams(search), isBot });
      return { repository, observability, resolve };
    }

    it('never asks Magento and resolves the product from the scraper for users (noindex)', async () => {
      const { resolve, repository } = withPlaceholder();

      const decision = await resolve(SKU_SEARCH, false);

      expect(decision).toEqual({
        kind: 'missing_product',
        case: 'missing_user',
        robots: { index: false, follow: true },
        canonicalUrl: `${BASE}/amazon-B00IJ0ALYS-search.html`,
        lookup: { sku: 'B00IJ0ALYS', vendor: 'amazon' },
        vendor: 'amazon',
        searchUrl: '/search.html?query=B00IJ0ALYS&store=amazon',
        origin: 'sku_search',
      });
      expect(repository.calls).toEqual([]);
    });

    it('is the missing-product 404 for bots, without Magento or scraper data', async () => {
      const { resolve, repository, observability } = withPlaceholder();

      expect(await resolve(SKU_SEARCH, true)).toEqual({ kind: 'not_found', case: 'missing_bot' });
      expect(repository.calls).toEqual([]);
      expect(observability.metricsNamed('BotRequest').map((m) => m.dimensions)).toEqual([
        { Page: 'product' },
      ]);
    });

    it('applies the eBay ?var= variant like product urls', async () => {
      const { resolve } = withPlaceholder();

      const decision = await resolve('/ebay-405512345678-search.html', false, 'var=999');

      expect(decision.kind === 'missing_product' && decision.lookup).toEqual({
        sku: '405512345678|999',
        vendor: 'ebay',
      });
    });

    it('matches the vendor case-insensitively', async () => {
      const { resolve, repository } = withPlaceholder();

      const decision = await resolve('/Amazon-B00IJ0ALYS-search.html', false);

      expect(decision).toMatchObject({
        kind: 'missing_product',
        lookup: { sku: 'B00IJ0ALYS', vendor: 'amazon' },
        origin: 'sku_search',
      });
      expect(repository.calls).toEqual([]);
    });

    it('decodes acme base64url sku segments', async () => {
      const { resolve } = withPlaceholder();

      const decision = await resolve('/acme-QUJD-search.html', false);

      expect(decision).toMatchObject({
        lookup: { sku: 'ABC', vendor: 'acme' },
        searchUrl: '/search.html?query=ABC&store=acme',
      });
    });

    it('keeps the unavailable state (no lookup) for an empty sku, still without Magento', async () => {
      const { resolve, repository } = withPlaceholder();

      const decision = await resolve('/amazon--search.html', false);

      expect(decision).toMatchObject({
        kind: 'missing_product',
        lookup: null,
        origin: 'sku_search',
        searchUrl: '/search.html?store=amazon',
      });
      expect(repository.calls).toEqual([]);
    });

    it.each([
      '/amazon-B00X-best-search.html',
      '/amazon-B00X-SEARCH.html',
      '/amazon-B00X-other.html',
    ])('keeps the Magento lookup for %s (not the sku jump shape)', async (pathname) => {
      const { resolve, repository } = withPlaceholder();

      await resolve(pathname, false);

      expect(repository.calls).toEqual([pathname.slice(1)]);
    });
  });

  describe('resolveSkuSearchCanonicalUrl', () => {
    const found = parseSearchProductResult(amazonFound);
    const product = found.status === 'found' ? found.product : null;
    const decision = {
      kind: 'missing_product',
      case: 'missing_user',
      robots: { index: false, follow: true },
      canonicalUrl: `${BASE}/amazon-B00IJ0ALYS-search.html`,
      lookup: { sku: 'B00IJ0ALYS', vendor: 'amazon' },
      vendor: 'amazon',
      searchUrl: '/search.html?query=B00IJ0ALYS&store=amazon',
      origin: 'sku_search',
    } as const satisfies ProductPageDecision;

    it('points to the product url search results link to once the scraper found it', () => {
      expect(
        resolveSkuSearchCanonicalUrl(BASE, decision, {
          kind: 'found',
          product: product!,
          copyRequest: decision.lookup,
        }),
      ).toBe(
        `${BASE}/amazon-B00IJ0ALYS-dewalt-kit-de-combo-de-perforaci-n-inal-mbrico-de-20v-max-dck240c2-.html`,
      );
    });

    it('keeps the sku search url for a found product without a usable title', () => {
      expect(
        resolveSkuSearchCanonicalUrl(BASE, decision, {
          kind: 'found',
          product: { ...product!, title: ' ¡! ' },
          copyRequest: decision.lookup,
        }),
      ).toBe(decision.canonicalUrl);
    });

    it.each(['not_found', 'error', 'unparsable_url'] as const)(
      'keeps the sku search url when the scraper outcome is %s',
      (reason) => {
        expect(resolveSkuSearchCanonicalUrl(BASE, decision, { kind: 'unavailable', reason })).toBe(
          decision.canonicalUrl,
        );
      },
    );
  });

  describe('other Magento routes', () => {
    it('maps 301 to a permanent redirect to the site-relative target', async () => {
      const { resolve } = setup();

      expect(await resolve('/old-shirt.html', true)).toEqual({
        kind: 'redirect',
        location: '/new-shirt.html',
        permanent: true,
      });
    });

    it('maps 302 to a temporary redirect', async () => {
      const { resolve } = setup();

      expect(await resolve('/sale.html', false)).toEqual({
        kind: 'redirect',
        location: '/promos.html',
        permanent: false,
      });
    });

    it('dispatches CMS pages', async () => {
      const { resolve } = setup();

      expect(await resolve('/about-us', false)).toEqual({
        kind: 'cms',
        identifier: 'about-us',
        relativeUrl: 'about-us',
      });
    });

    it('resolves the site root through Magento with route url /', async () => {
      const { resolve, repository } = setup();

      expect(await resolve('/', false)).toEqual({
        kind: 'cms',
        identifier: 'venia-new-home',
        relativeUrl: 'venia-new-home',
      });
      expect(repository.calls).toEqual(['/']);
    });

    it('hands categories to the category page with the uid Magento resolved', async () => {
      const { resolve } = setup();

      expect(await resolve('/men.html', false)).toEqual({
        kind: 'category',
        uid: 'MTI=',
        relativeUrl: 'men.html',
      });
    });
  });

  it('propagates a Magento outage instead of reporting not found', async () => {
    const { resolve } = setup({ failing: [EXISTING_URL] });

    await expect(resolve(`/${EXISTING_URL}`, false)).rejects.toBeInstanceOf(MagentoRequestError);
  });

  describe('observability', () => {
    it('counts bot requests by page type and the PDP outcome per case', async () => {
      const { resolve, observability } = setup();

      await resolve(`/${EXISTING_URL}`, true);
      await resolve(MISSING_PATH, false);
      await resolve('/about-us', true);
      await resolve('/men.html', true);

      expect(observability.metricsNamed('BotRequest').map((m) => m.dimensions)).toEqual([
        { Page: 'product' },
        { Page: 'cms' },
        { Page: 'category' },
      ]);
      expect(observability.metricsNamed('PdpOutcome').map((m) => m.dimensions)).toEqual([
        { Case: 'exists_bot' },
        { Case: 'missing_user' },
      ]);
    });
  });
});
