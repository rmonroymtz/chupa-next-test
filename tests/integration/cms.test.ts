import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import aviso from '../fixtures/page-builder/cms-page.aviso-privacidad.json';
import blocks from '../fixtures/page-builder/cms-blocks.sliders.json';
import storeConfig from '../fixtures/magento/store-config.json';
import { formatPrice } from '@/modules/product/ui/format-price';
import { startMockBackends, type MockBackends } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PUBLIC_BASE_URL = 'https://chupaprecios.com.mx';
const MEDIA = 'https://chupaprecios.com.mx/media/wysiwyg';

const cmsRoute = (identifier: string) => ({
  type: 'CMS_PAGE',
  redirect_code: 0,
  relative_url: identifier,
  identifier,
});

const productLink = (urlKey: string) =>
  `<li class="product-item"><div class="product-item-info"><div class="product-item-details"><strong class="product-item-name"><a class="product-item-link" href="${PUBLIC_BASE_URL}/${urlKey}.html">x</a></strong></div></div></li>`;

const slider = blocks.items.find((item) => item.identifier === 'top-banner-slider')!.content;

/** Synthetic Page Builder page mixing the live slider with images, products and tabs. */
const PROMO_CONTENT =
  slider +
  '<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">' +
  '<h2 data-content-type="heading" data-appearance="default" data-element="main">Ofertas de temporada</h2>' +
  `<figure data-content-type="image" data-element="main"><img src="${MEDIA}/promo.jpg" alt="Promoción" data-element="desktop_image"></figure>` +
  '<div data-content-type="products" data-appearance="grid" data-element="main"><ol>' +
  productLink('amazon-B0LAMP0001-desk-lamp') +
  productLink('ebay-1|2-shirt') +
  '</ol></div>' +
  '<div class="tab-align-left" data-content-type="tabs" data-appearance="default" data-active-tab="" data-element="main">' +
  '<ul role="tablist" data-element="navigation"><li role="tab" data-element="headers"><a href="#t1"><span>Envíos</span></a></li></ul>' +
  '<div data-element="content"><div data-content-type="tab-item" data-tab-name="Envíos" data-element="main" id="t1">' +
  '<div data-content-type="text" data-element="main"><p>Envíos a todo México.</p></div></div></div></div>' +
  '</div></div>';

let backends: MockBackends;
let next: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {
      'aviso-privacidad': cmsRoute('aviso-privacidad'),
      promociones: cmsRoute('promociones'),
      'pagina-borrada': cmsRoute('pagina-borrada'),
      'cms-caido': cmsRoute('cms-caido'),
    },
    cmsPages: {
      'aviso-privacidad': aviso.data.route,
      promociones: {
        identifier: 'promociones',
        url_key: 'promociones',
        relative_url: 'promociones',
        title: 'Promociones',
        content_heading: 'Promociones',
        content: PROMO_CONTENT,
        meta_title: 'Promociones del mes',
        meta_description: 'Las mejores ofertas de Estados Unidos.',
        meta_keywords: null,
        page_layout: 'cms-full-width',
      },
      'cms-caido': 'outage',
    },
    productsByUrlKey: {
      'amazon-B0LAMP0001-desk-lamp': {
        uid: 'lamp',
        sku: 'B0LAMP0001',
        name: 'Lámpara de escritorio',
        url_key: 'amazon-B0LAMP0001-desk-lamp',
        url_suffix: '.html',
        stock_status: 'IN_STOCK',
        small_image: { url: 'https://chupaprecios.com.mx/media/lamp.jpg', label: null },
        price_range: {
          minimum_price: {
            final_price: { value: 899.5, currency: 'MXN' },
            regular_price: { value: 1299, currency: 'MXN' },
            discount: { amount_off: 399.5, percent_off: 30.75 },
          },
        },
      },
    },
    storeConfig: storeConfig.data.storeConfig,
    chapi: {},
    chapiDefaultDelayMs: 0,
  });
  next = await startNext({
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL,
    MAGENTO_TIMEOUT_MS: '3000',
    LOG_LEVEL: 'warn',
  });
});

afterAll(async () => {
  await next?.stop();
  await backends?.close();
});

async function get(path: string, userAgent = BROWSER_UA) {
  backends.reset();
  const response = await fetch(`${next.baseUrl}${path}`, {
    headers: { 'User-Agent': userAgent },
    redirect: 'manual',
  });
  return { status: response.status, html: await response.text() };
}

const robots = (html: string) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? null;
const canonical = (html: string) => /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null;
const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null;

describe('CMS pages', () => {
  it.each([
    ['user', BROWSER_UA],
    ['bot', BOT_UA],
  ])(
    'live aviso-privacidad (%s): 200, indexable, canonical, Page Builder content',
    async (_, ua) => {
      const page = await get('/aviso-privacidad', ua);

      expect(page.status).toBe(200);
      expect(robots(page.html)).toBe('index, follow');
      expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/aviso-privacidad`);
      expect(title(page.html)).toBe('Aviso de privacidad | Chupaprecios');
      expect(page.html).toContain('<meta name="description" content="Aviso de privacidad"/>');
      expect(page.html).toContain('data-page-builder=""');
      expect(page.html).toContain('Aviso de privacidad</span></h4>');
      expect(page.html).toContain('De conformidad con lo establecido');
      // One cmsPage read per request, shared by metadata and page.
      expect(backends.callsTo('magento', 'CmsPage')).toHaveLength(1);
    },
  );

  it('Page Builder page with slider, image, products and tabs', async () => {
    const page = await get('/promociones');

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('index, follow');
    expect(title(page.html)).toBe('Promociones del mes | Chupaprecios');
    expect(page.html).toContain('<h1');
    expect(page.html).toContain('aria-roledescription="carrusel"');
    expect(page.html).toContain('Envío gratis');
    expect(page.html).toContain('Ofertas de temporada</h2>');
    expect(page.html).toMatch(
      new RegExp(`<img src="${MEDIA}/promo.jpg" alt="Promoción"[^>]*loading`),
    );
    expect(page.html).toContain('role="tablist"');
    expect(page.html).toContain('Envíos a todo México.');
    // Products content type: one query, url keys without the suffix, PDP price function.
    const productCalls = backends.callsTo('magento', 'ProductsByUrlKeys');
    expect(productCalls).toHaveLength(1);
    expect(productCalls[0]?.body.variables).toEqual({
      urlKeys: ['amazon-B0LAMP0001-desk-lamp', 'ebay-1|2-shirt'],
      pageSize: 2,
    });
    expect(page.html).toContain('href="/amazon-B0LAMP0001-desk-lamp.html"');
    expect(page.html).toContain(formatPrice(899.5, 'MXN'));
    expect(page.html).toContain(formatPrice(1299, 'MXN'));
  });

  it('identifier routed by Magento but the page is gone: 404', async () => {
    const page = await get('/pagina-borrada');
    expect(page.status).toBe(404);
  });

  it('Magento failure reading the CMS page: 5xx, never 404', async () => {
    const page = await get('/cms-caido');
    expect(page.status).toBeGreaterThanOrEqual(500);
  });
});
