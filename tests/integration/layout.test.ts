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
const MENU_TIMEOUT_MS = 1000;

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
    MAGENTO_MENU_TIMEOUT_MS: String(MENU_TIMEOUT_MS),
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
  backends.setMenuDelay(0);
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

const CATEGORY_LINK = (urlPath: string) => `href="/${urlPath}.html"`;

function expectLayout(html: string) {
  expect(html).toContain('href="#main-content"');
  expect(html).toContain('id="main-content"');
  expect(html).toMatch(/<header[^>]*>/);
  // The promo bar region sits above the header, its first slide server-rendered.
  const promo = html.indexOf('<section aria-label="Promociones"');
  expect(promo).toBeGreaterThan(-1);
  expect(promo).toBeLessThan(html.indexOf('<header'));
  expect(html).toContain('Envío gratis');
  const form = /<form[^>]*role="search"[^>]*>/.exec(html)?.[0] ?? '';
  expect(form).toContain('action="/search.html"');
  expect(form).toContain('method="get"');
  expect(html).toContain('data-slot="cart-trigger"');
  expect(html).toMatch(/<footer[^>]*>/);
  expect(html).toContain('href="/aviso-privacidad"');
  // Exactly one main landmark per page, rendered by the root layout as the skip-link target.
  expect(html.match(/<main[\s>]/g)).toHaveLength(1);
  expect(html).toMatch(/<main[^>]*id="main-content"/);
}

describe('site layout', () => {
  it('product page: header with the Magento menu, footer, 200 and indexable', async () => {
    const page = await get(`/${EXISTING}`);

    expect(page.status).toBe(200);
    expect(page.html).toContain('<meta name="robots" content="index, follow"/>');
    expectLayout(page.html);
    // Ordered by position, include_in_menu respected, category page urls at every level.
    const electronica = page.html.indexOf(CATEGORY_LINK('electronica'));
    const juguetes = page.html.indexOf(CATEGORY_LINK('juguetes'));
    expect(electronica).toBeGreaterThan(-1);
    expect(juguetes).toBeGreaterThan(electronica);
    expect(page.html).not.toContain('Interna');
    expect(page.html).toContain(CATEGORY_LINK('electronica/audio'));
    // The search form is the only way to the PWA Studio search page.
    expect(page.html).not.toContain('href="/search.html');
    // One menu query per request, shared by the desktop and mobile navigation.
    expect(backends.callsTo('magento', 'HeaderMenu')).toHaveLength(1);
  });

  it('CMS page: header and footer around the Page Builder content, 200', async () => {
    const page = await get('/aviso-privacidad', BOT_UA);

    expect(page.status).toBe(200);
    expectLayout(page.html);
    expect(page.html).toContain('data-page-builder=""');
    expect(page.html).toContain(CATEGORY_LINK('electronica'));
  });

  it.each([
    ['a missing product for a bot', `/${MISSING}`, BOT_UA],
    ['an unknown url', '/esta-pagina-no-existe', BROWSER_UA],
    ['an unknown url for a bot', '/esta-pagina-no-existe', BOT_UA],
  ])('%s: 404 and noindex, with the not-found copy in the RSC payload', async (_, path, ua) => {
    const response = await fetch(`${next.baseUrl}${path}`, {
      headers: { 'User-Agent': ua },
      redirect: 'manual',
    });
    const raw = await response.text();

    expect(response.status).toBe(404);
    expect(raw).toMatch(/<meta name="robots" content="noindex[^"]*"\/>/);
    // Next 16.4 dynamic rendering: `notFound()` thrown by the page escapes the
    // SSR shell (server rendering has no error boundaries), so the HTML is
    // Next's `__next_error__` recovery shell and the browser renders the
    // layout + not-found view from the inlined RSC payload. Characterized so
    // a Next upgrade that server-renders it is noticed.
    expect(raw).toContain('<html id="__next_error__">');
    expect(raw).toContain('Página no encontrada');
    expect(raw).toContain('main-content');
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
      expect(page.html).not.toContain(CATEGORY_LINK('electronica'));
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
    const sheets = await Promise.all(
      stylesheets.map(async (href) => ({
        url: new URL(href, next.baseUrl),
        css: await fetch(`${next.baseUrl}${href}`).then((r) => r.text()),
      })),
    );
    const faces = sheets.flatMap(({ url, css }) => fontFaces(css, url));
    for (const family of ['Inter', 'Roboto Flex']) {
      const ofFamily = faces.filter((face) => face.family === family);
      expect(ofFamily.length, family).toBeGreaterThan(0);
      for (const face of ofFamily) {
        expect(face.display, family).toBe('swap');
        expect(face.sources.length, family).toBeGreaterThan(0);
        for (const source of face.sources) {
          expect(source.origin, family).toBe(new URL(next.baseUrl).origin);
          expect(source.pathname.startsWith('/_next/static/media/'), source.pathname).toBe(true);
        }
      }
    }
    // The theme reads the next/font variables (with a fallback), and <html>
    // carries the classes that define them.
    const css = sheets.map((sheet) => sheet.css).join('\n');
    const htmlClasses = /<html[^>]*class="([^"]*)"/.exec(page)?.[1]?.split(/\s+/) ?? [];
    for (const variable of ['--next-font-inter', '--next-font-roboto-flex']) {
      expect(css).toContain(`var(${variable},`);
      const definedBy = [...css.matchAll(new RegExp(`\\.([\\w-]+)\\{[^}]*${variable}:`, 'g'))].map(
        (match) => match[1]!,
      );
      expect(
        definedBy.some((name) => htmlClasses.includes(name)),
        variable,
      ).toBe(true);
    }
    expect(css).not.toContain('fonts.gstatic.com');

    for (const asset of ['/images/layout/logo.svg', '/images/layout/stores/ebay.svg']) {
      const response = await fetch(`${next.baseUrl}${asset}`);
      expect(response.status, asset).toBe(200);
      expect(response.headers.get('content-type')).toContain('image/svg+xml');
      await response.body?.cancel();
    }
  });

  it('a menu slower than MAGENTO_MENU_TIMEOUT_MS streams the page first and keeps the status', async () => {
    backends.setMenuDelay(MENU_TIMEOUT_MS * 3);
    const response = await fetch(`${next.baseUrl}/${EXISTING}`, {
      headers: { 'User-Agent': BROWSER_UA },
    });
    const chunks: { seq: number; text: string }[] = [];
    const decoder = new TextDecoder();
    for await (const chunk of response.body ?? []) {
      chunks.push({
        seq: backends.nextSeq(),
        text: decoder.decode(chunk as Uint8Array, { stream: true }),
      });
    }
    const html = chunks.map((chunk) => chunk.text).join('');
    const [menuCall] = backends.callsTo('magento', 'HeaderMenu');

    expect(response.status).toBe(200);
    // Next gave up on the menu (client timeout), it was never answered...
    expect(menuCall?.abortedSeq).toBeDefined();
    expect(menuCall?.respondedSeq).toBeUndefined();
    // ...and the header had already reached the client before that: the
    // menu is streamed behind its own Suspense boundary.
    const firstHeader = chunks.find((chunk) => chunk.text.includes('<header'));
    expect(firstHeader).toBeDefined();
    expect(firstHeader!.seq).toBeLessThan(menuCall!.abortedSeq!);
    const rendered = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
    expectLayout(rendered);
    expect(rendered).not.toContain(CATEGORY_LINK('electronica'));
  });
});

interface FontFace {
  readonly family: string;
  readonly display: string | null;
  readonly sources: readonly URL[];
}

/** Every `@font-face` block of a stylesheet, with `src` urls resolved against the sheet url. */
function fontFaces(css: string, sheetUrl: URL): FontFace[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => {
    const declarations = new Map<string, string>();
    for (const declaration of match[1]!.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      declarations.set(
        declaration.slice(0, colon).trim().toLowerCase(),
        declaration.slice(colon + 1).trim(),
      );
    }
    const src = declarations.get('src') ?? '';
    return {
      family: (declarations.get('font-family') ?? '').replace(/^['"]|['"]$/g, ''),
      display: declarations.get('font-display') ?? null,
      sources: [...src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(
        (url) => new URL(url[1]!, sheetUrl),
      ),
    };
  });
}
