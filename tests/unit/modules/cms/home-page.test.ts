import { describe, expect, it } from 'vitest';
import type { HomePageSource } from '@/modules/cms/application/ports';
import { cmsCanonicalPath, resolveCmsPageRoute } from '@/modules/cms/application/home-page';
import type { CmsPage } from '@/modules/cms/domain/cms-page';
import { MagentoRequestError } from '@/shared/graphql/client';

const HOME = 'venia-new-home';

function homeSource(identifier: string | null | 'outage') {
  const source = {
    calls: 0,
    async getHomeIdentifier() {
      source.calls += 1;
      if (identifier === 'outage') {
        throw new MagentoRequestError({
          kind: 'http',
          operation: 'StoreConfig',
          status: 503,
          message: 'Fake outage',
        });
      }
      return identifier;
    },
  } satisfies HomePageSource & { calls: number };
  return source;
}

const page = (overrides: Partial<CmsPage> = {}): CmsPage => ({
  identifier: HOME,
  urlKey: HOME,
  relativeUrl: HOME,
  title: 'Inicio',
  contentHeading: null,
  content: '',
  metaTitle: null,
  metaDescription: null,
  metaKeywords: null,
  pageLayout: null,
  ...overrides,
});

describe('resolveCmsPageRoute', () => {
  it('serves the page Magento resolves for / as the home, without reading the store config', async () => {
    const home = homeSource(HOME);

    expect(
      await resolveCmsPageRoute({ pathname: '/', search: '', identifier: HOME }, home),
    ).toEqual({
      kind: 'home',
    });
    expect(home.calls).toBe(0);
  });

  it('redirects the configured home page own url to /', async () => {
    const home = homeSource(HOME);

    expect(
      await resolveCmsPageRoute({ pathname: `/${HOME}`, search: '', identifier: HOME }, home),
    ).toEqual({
      kind: 'redirect_home',
      location: '/',
    });
  });

  it('keeps the request query string on the redirect to /', async () => {
    expect(
      await resolveCmsPageRoute(
        { pathname: `/${HOME}`, search: 'utm_source=x', identifier: HOME },
        homeSource(HOME),
      ),
    ).toEqual({ kind: 'redirect_home', location: '/?utm_source=x' });
  });

  it('serves any other CMS page normally', async () => {
    expect(
      await resolveCmsPageRoute(
        { pathname: '/aviso-privacidad', search: '', identifier: 'aviso-privacidad' },
        homeSource(HOME),
      ),
    ).toEqual({ kind: 'page' });
  });

  it('serves the page normally when Magento has no home page configured', async () => {
    expect(
      await resolveCmsPageRoute(
        { pathname: `/${HOME}`, search: '', identifier: HOME },
        homeSource(null),
      ),
    ).toEqual({ kind: 'page' });
  });

  it('rejects when the store config cannot be read (5xx, never 404)', async () => {
    await expect(
      resolveCmsPageRoute(
        { pathname: `/${HOME}`, search: '', identifier: HOME },
        homeSource('outage'),
      ),
    ).rejects.toBeInstanceOf(MagentoRequestError);
  });
});

describe('cmsCanonicalPath', () => {
  it('is the site root for the home, never the page relative url', () => {
    expect(cmsCanonicalPath(page(), { kind: 'home' })).toBe('');
  });

  it("is Magento's relative url for any other page", () => {
    expect(cmsCanonicalPath(page({ relativeUrl: 'aviso-privacidad' }), { kind: 'page' })).toBe(
      'aviso-privacidad',
    );
  });
});
