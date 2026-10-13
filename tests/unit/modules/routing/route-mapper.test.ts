import { describe, expect, it } from 'vitest';
import { mapRoute } from '@/modules/routing/infrastructure/route-mapper';

const PRODUCT_URL =
  'ebay-126981644035|428130345038-gildan-6-pack-black-solid-heavy-cotton-short-sleeve-blank-t-shirt-s-3xl.html';

describe('mapRoute', () => {
  it('maps a null route to not_found', () => {
    expect(mapRoute(null, 'missing.html')).toEqual({ kind: 'not_found' });
  });

  it('maps a product route with a literal | in relative_url', () => {
    expect(
      mapRoute(
        { type: 'PRODUCT', redirect_code: 0, relative_url: PRODUCT_URL, uid: 'NzY2MzExOTA4' },
        PRODUCT_URL,
      ),
    ).toEqual({ kind: 'product', uid: 'NzY2MzExOTA4', relativeUrl: PRODUCT_URL });
  });

  it('maps a CMS page route', () => {
    expect(
      mapRoute(
        { type: 'CMS_PAGE', redirect_code: 0, relative_url: 'about-us', identifier: 'about-us' },
        'about-us',
      ),
    ).toEqual({ kind: 'cms', identifier: 'about-us', relativeUrl: 'about-us' });
  });

  it('maps a category route', () => {
    expect(
      mapRoute(
        { type: 'CATEGORY', redirect_code: 0, relative_url: 'men.html', uid: 'MTI=' },
        'men.html',
      ),
    ).toEqual({ kind: 'category', uid: 'MTI=', relativeUrl: 'men.html' });
  });

  it.each([301, 302])('maps redirect_code %i to a redirect, whatever the entity type', (code) => {
    expect(
      mapRoute(
        { type: 'PRODUCT', redirect_code: code, relative_url: 'new.html', uid: 'X' },
        'old.html',
      ),
    ).toEqual({ kind: 'redirect', relativeUrl: 'new.html', code });
  });

  it('falls back to the requested url when relative_url is missing', () => {
    expect(
      mapRoute(
        { type: 'CMS_PAGE', redirect_code: 0, relative_url: null, identifier: 'home' },
        'home',
      ),
    ).toEqual({ kind: 'cms', identifier: 'home', relativeUrl: 'home' });
  });

  it('maps an entity without its identifier or with an unknown type to not_found', () => {
    expect(
      mapRoute({ type: 'PRODUCT', redirect_code: 0, relative_url: 'a.html' }, 'a.html'),
    ).toEqual({
      kind: 'not_found',
    });
    expect(mapRoute({ type: null, redirect_code: 0, relative_url: 'a.html' }, 'a.html')).toEqual({
      kind: 'not_found',
    });
  });

  describe('redirects without a usable target (R3-003)', () => {
    it.each([
      ['an empty relative_url', ''],
      ['a null relative_url', null],
      ['the requested url', 'a.html'],
      ['the requested url with a leading slash', '/a.html'],
    ])('ignores a redirect with %s and resolves the entity', (_label, relativeUrl) => {
      expect(
        mapRoute(
          { type: 'PRODUCT', redirect_code: 301, relative_url: relativeUrl, uid: 'X' },
          'a.html',
        ),
      ).toEqual({ kind: 'product', uid: 'X', relativeUrl: 'a.html' });
    });

    it('treats an encoded | target equal to the requested url as no redirect', () => {
      expect(
        mapRoute(
          { type: 'PRODUCT', redirect_code: 302, relative_url: 'ebay-1%7C2-x.html', uid: 'X' },
          'ebay-1|2-x.html',
        ),
      ).toEqual({ kind: 'product', uid: 'X', relativeUrl: 'ebay-1|2-x.html' });
    });

    it('maps a self-redirect without an entity to not_found', () => {
      expect(mapRoute({ type: null, redirect_code: 301, relative_url: '' }, 'a.html')).toEqual({
        kind: 'not_found',
      });
    });
  });
});
