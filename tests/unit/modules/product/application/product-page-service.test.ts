import { describe, expect, it } from 'vitest';
import type { MagentoProduct } from '@/modules/product/domain/product';
import { createProductPageService } from '@/modules/product/application/product-page-service';
import {
  mapProductRoute,
  type ProductRouteDto,
} from '@/modules/product/infrastructure/magento-product-mapper';
import { MagentoRequestError } from '@/shared/graphql/client';
import { FakeMagentoProductRepository } from '../../../../support/fakes';
import { createCapturingObservability } from '../../../../support/observability';
import fixture from '../../../../fixtures/magento/product-by-route.simple.json';

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
