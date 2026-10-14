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

/**
 * Three top-level rows; the middle one lists a product whose name Magento
 * returns malformed (an object). The mapper only checks truthiness, so the
 * value reaches the product card and React throws while rendering it
 * ("Objects are not valid as a React child"), after the node's element tree
 * was built: the synchronous try/catch cannot see it, only the per-node
 * Suspense boundary can.
 */
const BROKEN_NODE_CONTENT =
  '<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">' +
  '<h2 data-content-type="heading" data-appearance="default" data-element="main">Antes del nodo roto</h2>' +
  '</div></div>' +
  '<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">' +
  '<h3 data-content-type="heading" data-appearance="default" data-element="main">Fila del nodo roto</h3>' +
  '<div data-content-type="products" data-appearance="grid" data-element="main"><ol>' +
  productLink('amazon-B0BROKEN01-broken-product') +
  '</ol></div></div></div>' +
  '<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">' +
  '<div data-content-type="text" data-element="main"><p>Después del nodo roto</p></div>' +
  '</div></div>';

const HOME = 'venia-new-home';

/**
 * Hand-made stand-in for the home CMS page: it only drives routing and
 * metadata. The real `venia-new-home` Page Builder content is not recorded yet.
 */
const HOME_PAGE = {
  identifier: HOME,
  url_key: HOME,
  relative_url: HOME,
  title: 'Inicio',
  content_heading: null,
  content:
    '<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">' +
    '<div data-content-type="text" data-element="main"><p>Contenido de la portada</p></div></div></div>',
  meta_title: 'Acceso a más de 300 millones de productos',
  meta_description: 'Compra en tiendas de Estados Unidos.',
  meta_keywords: null,
  page_layout: 'cms-full-width',
};

let backends: MockBackends;
let next: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {
      'aviso-privacidad': cmsRoute('aviso-privacidad'),
      promociones: cmsRoute('promociones'),
      'pagina-borrada': cmsRoute('pagina-borrada'),
      'cms-caido': cmsRoute('cms-caido'),
      'nodo-roto': cmsRoute('nodo-roto'),
      // Verified live: Magento resolves the root to its configured home page.
      '/': cmsRoute(HOME),
      [HOME]: cmsRoute(HOME),
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
      [HOME]: HOME_PAGE,
      'nodo-roto': {
        identifier: 'nodo-roto',
        url_key: 'nodo-roto',
        relative_url: 'nodo-roto',
        title: 'Nodo roto',
        content_heading: null,
        content: BROKEN_NODE_CONTENT,
        meta_title: null,
        meta_description: null,
        meta_keywords: null,
        page_layout: 'cms-full-width',
      },
    },
    productsByUrlKey: {
      'amazon-B0BROKEN01-broken-product': {
        uid: 'broken',
        sku: 'B0BROKEN01',
        name: { label: 'Malformed name' },
        url_key: 'amazon-B0BROKEN01-broken-product',
        url_suffix: '.html',
        stock_status: 'IN_STOCK',
        small_image: null,
        price_range: null,
      },
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
    // The recording predates cms_home_page.
    storeConfig: { ...storeConfig.data.storeConfig, cms_home_page: HOME },
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
  return {
    status: response.status,
    location: response.headers.get('location'),
    html: await response.text(),
  };
}

const robots = (html: string) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? null;
const canonical = (html: string) => /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] ?? null;
const withoutScripts = (html: string) => html.replace(/<script\b[\s\S]*?<\/script>/g, '');
const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? null;
const jsonLdTypes = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => (JSON.parse(match[1] ?? '{}') as { '@type'?: string })['@type'],
  );

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

  it('a node that throws while React renders it is left out; the page is 200 and the rest renders', async () => {
    const page = await get('/nodo-roto');
    // Rendered markup only: the inline RSC payload scripts still carry every node's data.
    const markup = withoutScripts(page.html);

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('index, follow');
    expect(markup).toContain('Antes del nodo roto</h2>');
    expect(markup).toContain('<p>Después del nodo roto</p>');
    // The failing top-level node is not in the server HTML: its Suspense
    // boundary switched to client rendering (`<!--$!-->`), where the node
    // error boundary drops it.
    expect(markup).not.toContain('Fila del nodo roto');
    expect(markup).toContain('<!--$!-->');
    expect(backends.callsTo('magento', 'ProductsByUrlKeys')).toHaveLength(1);
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

describe('home', () => {
  it('/ is resolved by Magento: home CMS page, canonical /, site JSON-LD once', async () => {
    const page = await get('/');

    expect(page.status).toBe(200);
    expect(robots(page.html)).toBe('index, follow');
    // Next renders the root url without its trailing slash (same url).
    expect(canonical(page.html)).toBe(PUBLIC_BASE_URL);
    expect(page.html).toMatch(
      new RegExp(`<meta property="og:url" content="${PUBLIC_BASE_URL}/?"/>`),
    );
    expect(title(page.html)).toBe('Acceso a más de 300 millones de productos | Chupaprecios');
    expect(page.html).toContain('<h1 class="sr-only">Inicio</h1>');
    expect(page.html).toContain('Contenido de la portada');
    expect(jsonLdTypes(page.html).sort()).toEqual(['Organization', 'WebSite']);
    expect(
      backends.callsTo('magento', 'ProductByRoute').map((call) => call.body.variables),
    ).toEqual([{ url: '/' }]);
    expect(backends.callsTo('magento', 'CmsPage')).toHaveLength(1);
  });

  it("the home page's own url answers a permanent redirect to /", async () => {
    const page = await get(`/${HOME}`);

    expect(page.status).toBe(308);
    expect(page.location).toBe('/');
    expect(backends.callsTo('magento', 'CmsPage')).toHaveLength(0);
  });

  it('other CMS pages keep their own canonical', async () => {
    const page = await get('/aviso-privacidad');

    expect(page.status).toBe(200);
    expect(canonical(page.html)).toBe(`${PUBLIC_BASE_URL}/aviso-privacidad`);
  });
});
