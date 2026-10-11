import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import productRoute from '../fixtures/magento/product-by-route.simple.json';
import storeConfig from '../fixtures/magento/store-config.json';
import aviso from '../fixtures/page-builder/cms-page.aviso-privacidad.json';
import { startMockBackends, type MockBackends } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PUBLIC_BASE_URL = 'https://chupaprecios.com.mx';
const EXISTING = productRoute.data.route.relative_url;
const MISSING = 'ebay-126981644035-gildan-heavy-cotton-t-shirt.html';

const category = (name: string, urlPath: string, position: number, children: unknown[] = []) => ({
  uid: `uid-${urlPath}`,
  name,
  include_in_menu: 1,
  position,
  url_path: urlPath,
  children,
});

const MENU = {
  storeConfig: { store_code: 'default', category_url_suffix: '.html' },
  categoryList: [
    {
      uid: 'root',
      name: 'Default Category',
      children: [
        category('Juguetes', 'juguetes', 2),
        category('Electrónica', 'electronica', 1, [category('Audio', 'electronica/audio', 1)]),
        { ...category('Interna', 'interna', 3), include_in_menu: 0 },
      ],
    },
  ],
};

let backends: MockBackends;
let next: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {
      [EXISTING]: productRoute.data.route,
      'aviso-privacidad': {
        type: 'CMS_PAGE',
        redirect_code: 0,
        relative_url: 'aviso-privacidad',
        identifier: 'aviso-privacidad',
      },
    },
    cmsPages: { 'aviso-privacidad': aviso.data.route },
    storeConfig: storeConfig.data.storeConfig,
    menu: MENU,
    chapi: {},
    chapiDefaultDelayMs: 0,
  });
  next = await startNext({
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL,
    MAGENTO_TIMEOUT_MS: '3000',
    MAGENTO_MENU_TIMEOUT_MS: '1000',
    COPY_MUTATION_TIMEOUT_MS: '3000',
    LOG_LEVEL: 'error',
  });
});

afterAll(async () => {
  await next?.stop();
  await backends?.close();
});

beforeEach(() => {
  backends.reset();
  backends.setMenu(MENU);
});

async function get(path: string, userAgent = BROWSER_UA) {
  const response = await fetch(`${next.baseUrl}${path}`, {
    headers: { 'User-Agent': userAgent },
    redirect: 'manual',
  });
  const html = await response.text();
  // Rendered markup only: the inline RSC payload scripts repeat the data.
  return { status: response.status, html: html.replace(/<script\b[\s\S]*?<\/script>/g, '') };
}

const SEARCH_LINK = (urlPath: string) =>
  `href="/search.html?query=${encodeURIComponent(urlPath)}&amp;store=amazon&amp;page=1"`;

function expectLayout(html: string) {
  expect(html).toContain('href="#main-content"');
  expect(html).toContain('id="main-content"');
  expect(html).toMatch(/<header[^>]*>/);
  const form = /<form[^>]*role="search"[^>]*>/.exec(html)?.[0] ?? '';
  expect(form).toContain('action="/search.html"');
  expect(form).toContain('method="get"');
  expect(html).toContain('data-slot="cart-trigger"');
  expect(html).toMatch(/<footer[^>]*>/);
  expect(html).toContain('href="/aviso-privacidad"');
  // Exactly one main landmark per page (rendered by the page itself).
  expect(html.match(/<main[\s>]/g)).toHaveLength(1);
}

describe('site layout', () => {
  it('product page: header with the Magento menu, footer, 200 and indexable', async () => {
    const page = await get(`/${EXISTING}`);

    expect(page.status).toBe(200);
    expect(page.html).toContain('<meta name="robots" content="index, follow"/>');
    expectLayout(page.html);
    // Ordered by position, include_in_menu respected, legacy search urls.
    const electronica = page.html.indexOf(SEARCH_LINK('electronica'));
    const juguetes = page.html.indexOf(SEARCH_LINK('juguetes'));
    expect(electronica).toBeGreaterThan(-1);
    expect(juguetes).toBeGreaterThan(electronica);
    expect(page.html).not.toContain('Interna');
    expect(page.html).toContain('href="/electronica/audio.html"');
    // One menu query per request, shared by the desktop and mobile navigation.
    expect(backends.callsTo('magento', 'HeaderMenu')).toHaveLength(1);
  });

  it('CMS page: header and footer around the Page Builder content, 200', async () => {
    const page = await get('/aviso-privacidad', BOT_UA);

    expect(page.status).toBe(200);
    expectLayout(page.html);
    expect(page.html).toContain('data-page-builder=""');
    expect(page.html).toContain(SEARCH_LINK('electronica'));
  });

  it('a missing product for a bot is still a 404 (the layout does not change the status)', async () => {
    const page = await get(`/${MISSING}`, BOT_UA);

    // Observed before T7 as well: Next serves `notFound()` from this route as
    // an empty error shell, so the layout markup is not asserted here.
    expect(page.status).toBe(404);
    expect(page.html).toContain('<meta name="robots" content="noindex"/>');
  });

  it.each([
    ['outage', 'outage' as const],
    ['unknown operation (HTTP 400)', undefined],
  ])('menu query failure (%s): same statuses, header without categories', async (_, menu) => {
    backends.setMenu(menu);

    const product = await get(`/${EXISTING}`);
    const cms = await get('/aviso-privacidad');

    for (const page of [product, cms]) {
      expect(page.status).toBe(200);
      expectLayout(page.html);
      expect(page.html).not.toContain(SEARCH_LINK('electronica'));
      // Desktop bar keeps its reserved height; the mobile drawer keeps sign-in.
      expect(page.html).not.toContain('aria-label="Categorías"');
      expect(page.html).toContain('aria-label="Menú principal"');
    }
    expect(cms.html).toContain('data-page-builder=""');
  });

  it('serves the layout assets from the app (no third-party font or image hosts)', async () => {
    const page = await fetch(`${next.baseUrl}/${EXISTING}`, {
      headers: { 'User-Agent': BROWSER_UA },
    }).then((response) => response.text());
    expect(page).not.toContain('fonts.googleapis.com');
    expect(page).not.toContain('fonts.gstatic.com');
    // Font faces come from this app's own static assets, with `swap`.
    const stylesheets = [...page.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)].map(
      (match) => match[1]!,
    );
    expect(stylesheets.length).toBeGreaterThan(0);
    const css = (
      await Promise.all(
        stylesheets.map((href) => fetch(`${next.baseUrl}${href}`).then((r) => r.text())),
      )
    ).join('\n');
    for (const family of ['Roboto Flex', 'Noto Sans', 'Montserrat']) {
      expect(css).toMatch(
        new RegExp(
          `@font-face\\{font-family:${family};[^}]*font-display:swap;src:url\\(\\.\\./media/`,
        ),
      );
    }
    expect(css).not.toContain('fonts.gstatic.com');

    for (const asset of ['/images/layout/logo.svg', '/images/layout/stores/ebay.svg']) {
      const response = await fetch(`${next.baseUrl}${asset}`);
      expect(response.status, asset).toBe(200);
      expect(response.headers.get('content-type')).toContain('image/svg+xml');
      await response.body?.cancel();
    }
  });
});
