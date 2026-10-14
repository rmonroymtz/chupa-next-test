import { describe, expect, it } from 'vitest';
import {
  createCmsPageOverrides,
  resolveCmsPageView,
  type CmsPageViewDeps,
} from '@/modules/cms/application/cms-page-view';
import type { CmsPageRepository, HomePageSource } from '@/modules/cms/application/ports';
import type { CmsPage } from '@/modules/cms/domain/cms-page';
import { MagentoRequestError } from '@/shared/graphql/client';

const HOME = 'venia-new-home';

/** Stand-in for a Next page component; the decision never renders it. */
type FakeOverride = { readonly name: string };
const HOME_OVERRIDE: FakeOverride = { name: 'home override' };

const page = (identifier: string, overrides: Partial<CmsPage> = {}): CmsPage => ({
  identifier,
  urlKey: identifier,
  relativeUrl: identifier,
  title: identifier,
  contentHeading: null,
  content: '<p>Magento content</p>',
  metaTitle: null,
  metaDescription: null,
  metaKeywords: null,
  pageLayout: null,
  ...overrides,
});

const outage = () =>
  new MagentoRequestError({ kind: 'http', operation: 'CmsPage', status: 503, message: 'Fake' });

function pagesOf(entries: Record<string, CmsPage | 'outage'>) {
  const pages = {
    reads: [] as string[],
    async findByIdentifier(identifier: string) {
      pages.reads.push(identifier);
      const entry = entries[identifier];
      if (entry === 'outage') throw outage();
      return entry ?? null;
    },
  } satisfies CmsPageRepository & { reads: string[] };
  return pages;
}

const home: HomePageSource = { getHomeIdentifier: async () => HOME };

function deps(
  pages: CmsPageRepository,
  registry: ReadonlyMap<string, FakeOverride> = new Map(),
): CmsPageViewDeps<FakeOverride> {
  return { pages, home, overrides: createCmsPageOverrides(registry) };
}

describe('resolveCmsPageView', () => {
  it('renders the registered Next component for the CMS identifier, with the Magento page', async () => {
    const view = await resolveCmsPageView(
      { pathname: '/aviso-privacidad', search: '', identifier: 'aviso-privacidad' },
      deps(
        pagesOf({ 'aviso-privacidad': page('aviso-privacidad') }),
        new Map([['aviso-privacidad', HOME_OVERRIDE]]),
      ),
    );

    expect(view).toEqual({
      kind: 'page',
      page: page('aviso-privacidad'),
      canonicalPath: 'aviso-privacidad',
      override: HOME_OVERRIDE,
    });
  });

  it('renders the Magento content when no component is registered for the identifier', async () => {
    const view = await resolveCmsPageView(
      { pathname: '/aviso-privacidad', search: '', identifier: 'aviso-privacidad' },
      deps(
        pagesOf({ 'aviso-privacidad': page('aviso-privacidad') }),
        new Map([[HOME, HOME_OVERRIDE]]),
      ),
    );

    expect(view).toMatchObject({ kind: 'page', override: null });
  });

  it('serves an override registered for the home identifier at / with canonical /', async () => {
    const view = await resolveCmsPageView(
      { pathname: '/', search: '', identifier: HOME },
      deps(pagesOf({ [HOME]: page(HOME) }), new Map([[HOME, HOME_OVERRIDE]])),
    );

    expect(view).toEqual({
      kind: 'page',
      page: page(HOME),
      canonicalPath: '',
      override: HOME_OVERRIDE,
    });
  });

  it("keeps redirecting the home page's own url to / even with an override, without reading the page", async () => {
    const pages = pagesOf({ [HOME]: page(HOME) });

    const view = await resolveCmsPageView(
      { pathname: `/${HOME}`, search: 'utm_source=x', identifier: HOME },
      deps(pages, new Map([[HOME, HOME_OVERRIDE]])),
    );

    expect(view).toEqual({ kind: 'redirect_home', location: '/?utm_source=x' });
    expect(pages.reads).toEqual([]);
  });

  it('is not found when Magento has no such page, even with an override registered', async () => {
    const view = await resolveCmsPageView(
      { pathname: '/pagina-borrada', search: '', identifier: 'pagina-borrada' },
      deps(pagesOf({}), new Map([['pagina-borrada', HOME_OVERRIDE]])),
    );

    expect(view).toEqual({ kind: 'not_found' });
  });

  it('rejects when Magento fails reading the page (5xx, never the override or a 404)', async () => {
    await expect(
      resolveCmsPageView(
        { pathname: '/cms-caido', search: '', identifier: 'cms-caido' },
        deps(pagesOf({ 'cms-caido': 'outage' }), new Map([['cms-caido', HOME_OVERRIDE]])),
      ),
    ).rejects.toBeInstanceOf(MagentoRequestError);
  });
});

describe('createCmsPageOverrides', () => {
  it('finds only registered identifiers, never inherited object keys', () => {
    const overrides = createCmsPageOverrides(new Map([[HOME, HOME_OVERRIDE]]));

    expect(overrides.find(HOME)).toBe(HOME_OVERRIDE);
    expect(overrides.find('constructor')).toBeNull();
    expect(overrides.find('__proto__')).toBeNull();
    expect(overrides.find('aviso-privacidad')).toBeNull();
  });
});
