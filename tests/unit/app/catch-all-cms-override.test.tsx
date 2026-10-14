import { http, HttpResponse } from 'msw';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatchAllPage, { generateMetadata } from '@/app/[[...path]]/page';
import type { CmsPageOverrideProps } from '@/modules/cms/ui/cms-page-overrides';
import { MagentoRequestError } from '@/shared/graphql/client';
import { resetServerEnvForTests } from '@/shared/config/env';
import storeConfig from '../../fixtures/magento/store-config.json';
import { setupMswServer } from '../../support/msw';

/**
 * Route-level proof of the CMS override branch: the real catch-all page and
 * generateMetadata, the real CMS composition and repositories against a
 * mocked Magento (MSW). Only the request scope (`next/headers`), Magento
 * `route()` (covered by the product page service), the override registry and
 * the Page Builder renderer are replaced. The integration suite runs the
 * built server, where a test override would have to ship in production code.
 */

const MAGENTO = 'https://magento.test/graphql';
const BASE_URL = 'https://chupaprecios.com.mx';
const HOME = 'venia-new-home';
const OVERRIDDEN = 'promo-next';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'test' }) }));

// Magento `route()`: `/` resolves to the home page, any other path to the CMS page of that name.
vi.mock('@/modules/product/infrastructure/product-page.composition', () => ({
  resolveProductPage: async (pathname: string) => {
    const identifier = pathname === '/' ? 'venia-new-home' : pathname.slice(1);
    return { kind: 'cms', identifier, relativeUrl: identifier };
  },
  getCopyTrigger: () => ({ trigger: async () => undefined }),
}));

// Test overrides: the shipped registry is empty. Each renders Magento data and a CMS block.
vi.mock('@/modules/cms/ui/cms-page-overrides', async () => {
  const { CmsBlock } = await import('@/modules/cms/ui/cms-block');
  const Override = ({ page }: CmsPageOverrideProps) => (
    <main data-override={page.identifier}>
      <h1>{page.title}</h1>
      <CmsBlock identifier="hero-slider-container" />
    </main>
  );
  return {
    CMS_PAGE_OVERRIDES: new Map([
      ['promo-next', Override],
      ['venia-new-home', Override],
    ]),
  };
});

// The Page Builder pipeline has its own tests; here it only echoes the content.
vi.mock('@/modules/page-builder/ui/page-builder-content', () => ({
  PageBuilderContent: ({ content, source }: { content: string; source: string }) => (
    <section data-source={source} dangerouslySetInnerHTML={{ __html: content }} />
  ),
}));

const cmsPage = (identifier: string, title: string) => ({
  identifier,
  url_key: identifier,
  relative_url: identifier,
  title,
  content: `<p>Magento content of ${identifier}</p>`,
  content_heading: null,
  meta_title: `${title} (meta)`,
  meta_description: `Description of ${identifier}`,
  meta_keywords: null,
  page_layout: 'cms-full-width',
});

const PAGES: Record<string, ReturnType<typeof cmsPage>> = {
  [OVERRIDDEN]: cmsPage(OVERRIDDEN, 'Promociones Next'),
  [HOME]: cmsPage(HOME, 'Inicio'),
  'aviso-privacidad': cmsPage('aviso-privacidad', 'Aviso de privacidad'),
};

const server = setupMswServer();
let blocks: 'outage' | 'found';

beforeEach(() => {
  vi.stubEnv('MAGENTO_GRAPHQL_URL', MAGENTO);
  vi.stubEnv('PUBLIC_BASE_URL', BASE_URL);
  vi.stubEnv('CHAPI_BASE_URL', 'https://chapi.test');
  resetServerEnvForTests();
  blocks = 'found';
  server.use(
    http.post(MAGENTO, async ({ request }) => {
      const body = (await request.json()) as {
        operationName: string;
        variables: Record<string, unknown>;
      };
      switch (body.operationName) {
        case 'StoreConfig':
          return HttpResponse.json({
            data: { storeConfig: { ...storeConfig.data.storeConfig, cms_home_page: HOME } },
          });
        case 'CmsPage':
          return HttpResponse.json({
            data: { cmsPage: PAGES[String(body.variables.identifier)] ?? null },
          });
        case 'CmsBlocks':
          return blocks === 'outage'
            ? HttpResponse.json({ message: 'down' }, { status: 503 })
            : HttpResponse.json({
                data: {
                  cmsBlocks: {
                    items: [
                      {
                        identifier: 'hero-slider-container',
                        title: 'Hero',
                        content: '<p>Hero block</p>',
                      },
                    ],
                  },
                },
              });
        default:
          return HttpResponse.json({ errors: [{ message: 'unexpected' }] }, { status: 400 });
      }
    }),
  );
});

const props = (path?: string[]) => ({
  params: Promise.resolve(path ? { path } : {}),
  searchParams: Promise.resolve({}),
});

/**
 * Resolves async Server Components the way the RSC renderer does (in order,
 * outside any Suspense boundary, so a rejection fails the whole render), then
 * renders the resulting tree to HTML.
 */
async function resolveTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function') {
    const component = element.type as (props: unknown) => ReactNode | Promise<ReactNode>;
    return resolveTree(await component(element.props));
  }
  if (element.props.children === undefined) return element;
  return cloneElement(element, undefined, await resolveTree(element.props.children));
}

const renderPage = async (path?: string[]) =>
  renderToStaticMarkup(<>{await resolveTree(await CatchAllPage(props(path)))}</>);

describe('catch-all CMS branch with a registered Next override', () => {
  it('renders the registered component with the Magento page and its CMS block', async () => {
    const html = await renderPage([OVERRIDDEN]);

    expect(html).toBe(
      '<main data-override="promo-next"><h1>Promociones Next</h1>' +
        '<div data-cms-block="hero-slider-container"><section data-source="cms-block:hero-slider-container"><p>Hero block</p></section></div></main>',
    );
    expect(html).not.toContain('Magento content of promo-next');
  });

  it('keeps the Magento metadata and canonical for an overridden page', async () => {
    const metadata = await generateMetadata(props([OVERRIDDEN]));

    expect(metadata).toMatchObject({
      title: 'Promociones Next (meta)',
      description: 'Description of promo-next',
      robots: { index: true, follow: true },
      alternates: { canonical: `${BASE_URL}/promo-next` },
    });
  });

  it('serves an override registered for the home identifier at / with canonical /', async () => {
    const html = await renderPage();
    const metadata = await generateMetadata(props());

    expect(html).toContain('<main data-override="venia-new-home"><h1>Inicio</h1>');
    expect(metadata.alternates?.canonical).toMatch(new RegExp(`^${BASE_URL}/?$`));
    expect(metadata.title).toBe('Inicio (meta)');
  });

  it('renders the Magento content when no component is registered for the identifier', async () => {
    const html = await renderPage(['aviso-privacidad']);

    expect(html).toContain('data-cms-identifier="aviso-privacidad"');
    expect(html).toContain('<p>Magento content of aviso-privacidad</p>');
    expect(html).not.toContain('data-override');
  });

  it('a Magento failure reading a CMS block inside an override rejects the render (5xx)', async () => {
    blocks = 'outage';

    await expect(renderPage([OVERRIDDEN])).rejects.toBeInstanceOf(MagentoRequestError);
  });
});
