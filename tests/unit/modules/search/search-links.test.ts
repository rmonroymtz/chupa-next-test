import { describe, expect, it } from 'vitest';
import {
  clearFiltersHref,
  pageLinkHref,
  storeParamsHref,
  storeTabHref,
} from '@/modules/search/domain/search-links';

const AMAZON_LINK =
  '/-/es/s?k=drill&rh=p_123%3A195991%257C359095&dc&qid=1792088459&ref=sr_nr_p_123_2&ds=v1%3A%2FUEKRHcQdeAGb1A5Cgp5TwZ0ISUrdbRtBCEo9l%2BSWWI';
const EBAY_LINK =
  'q=drill&limit=16&fieldgroups=FULL,EXTENDED&aspect_filter=categoryId%3A184655%2CBattery%20Included%3A%7BYes%7D';

/** Reads a built href back the way the search route does. */
const read = (href: string) => {
  const url = new URL(href, 'https://chupaprecios.com.mx');
  return { path: url.pathname, params: [...url.searchParams.entries()] };
};

describe('search links (legacy `?query&store&page&storeParams` model)', () => {
  it('pagination link: page = the link title, storeParams = the CHAPI link byte for byte', () => {
    const href = pageLinkHref({ query: 'taladro', store: 'amazon' }, '3', AMAZON_LINK);

    expect(read(href)).toEqual({
      path: '/search.html',
      params: [
        ['query', 'taladro'],
        ['store', 'amazon'],
        ['page', '3'],
        ['storeParams', AMAZON_LINK],
      ],
    });
  });

  it.each([AMAZON_LINK, EBAY_LINK])(
    'sort and refinement links: page 1 and the option link as storeParams (%#)',
    (link) => {
      const href = storeParamsHref({ query: 'taladro & más', store: 'ebay' }, link);

      expect(read(href).params).toEqual([
        ['query', 'taladro & más'],
        ['store', 'ebay'],
        ['page', '1'],
        ['storeParams', link],
      ]);
    },
  );

  it('store tab: same query, the new store, page 1 and no storeParams', () => {
    expect(read(storeTabHref('taladro', 'target'))).toEqual({
      path: '/search.html',
      params: [
        ['query', 'taladro'],
        ['store', 'target'],
        ['page', '1'],
      ],
    });
  });

  it('clear filters: the current store on page 1 without storeParams', () => {
    expect(clearFiltersHref({ query: 'taladro', store: 'amazon' })).toBe(
      storeTabHref('taladro', 'amazon'),
    );
  });

  it('encodes characters that would break the query string', () => {
    const href = storeParamsHref({ query: 'a+b #1', store: 'amazon' }, '/s?k=a+b&x=1#y');

    expect(href).not.toContain('#');
    expect(read(href).params).toEqual([
      ['query', 'a+b #1'],
      ['store', 'amazon'],
      ['page', '1'],
      ['storeParams', '/s?k=a+b&x=1#y'],
    ]);
  });
});
