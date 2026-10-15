import { describe, expect, it } from 'vitest';
import { parseProductUrl } from '@/modules/product/domain/product-url';
import {
  parseSearchResponse,
  parseSortResponse,
} from '@/modules/search/infrastructure/chapi-search-mapper';
import { DEFAULT_PRODUCT_VENDORS } from '@/shared/config/env';
import empty from '../../../fixtures/chapi/search.amazon-empty.json';
import dewalt from '../../../fixtures/chapi/search.amazon-taladro.dewalt.json';
import amazon from '../../../fixtures/chapi/search.amazon-taladro.json';
import page2 from '../../../fixtures/chapi/search.amazon-taladro.page-2.json';
import priceAsc from '../../../fixtures/chapi/search.amazon-taladro.price-asc.json';
import ebay from '../../../fixtures/chapi/search.ebay-taladro.json';
import sortBy from '../../../fixtures/chapi/search-sort-by.amazon-taladro.json';

const vendors = DEFAULT_PRODUCT_VENDORS;

function ok(payload: unknown, store = 'amazon') {
  const result = parseSearchResponse(payload, { requestedStore: store, vendors });
  if (result.status !== 'ok') throw new Error(`expected ok, got ${result.status}`);
  return result.data;
}

describe('parseSearchResponse (recorded staging responses)', () => {
  it('maps amazon items to product cards linking to the Next product url', () => {
    const result = ok(amazon);

    expect(result.vendor).toBe('amazon');
    expect(result.skippedItems).toBe(0);
    expect(result.items).toHaveLength(amazon.data.products.length);
    expect(result.items[1]).toEqual({
      uid: 'amazon-B00IJ0ALYS',
      sku: 'B00IJ0ALYS',
      name: amazon.data.products[1]!.title,
      urlKey: expect.stringMatching(/^amazon-B00IJ0ALYS-dewalt-kit-de-combo-/),
      relativeUrl: expect.stringMatching(/^amazon-B00IJ0ALYS-dewalt-.*\.html$/),
      image: {
        url: amazon.data.products[1]!.image.src,
        label: amazon.data.products[1]!.image.alt,
      },
      price: {
        final: { amount: 4434.6, currency: 'MXN' },
        regular: { amount: 6853.86, currency: 'MXN' },
        discount: null,
      },
      availability: 'in_stock',
      brand: null,
      rating: 4.7,
    });
  });

  it('uses the current price as regular when there is no higher previous price', () => {
    const [first] = ok(amazon).items;

    expect(first?.price).toEqual({
      final: { amount: 1082.88, currency: 'MXN' },
      regular: { amount: 1082.88, currency: 'MXN' },
      discount: null,
    });
  });

  it('maps pagination links, prev and next as opaque strings', () => {
    expect(ok(amazon).pagination).toEqual({
      current: 1,
      totalPages: null,
      next: amazon.data.pagination.next,
      prev: null,
      links: amazon.data.pagination.links,
    });
    expect(ok(page2).pagination).toMatchObject({
      current: 2,
      prev: page2.data.pagination.prev,
      links: [
        { title: '1', link: page2.data.pagination.links[0]!.link },
        { title: '3', link: page2.data.pagination.links[1]!.link },
      ],
    });
  });

  it('maps refinements with their type, options and checked state', () => {
    const result = ok(dewalt);
    const [brands] = result.refinements;

    expect(result.refinements).toHaveLength(dewalt.data.refinements.length);
    expect(brands).toMatchObject({ title: 'Marcas', type: 'checkbox' });
    expect(brands?.options[0]).toEqual({
      title: 'DEWALT',
      link: dewalt.data.refinements[0]!.links[0]!.link,
      checked: true,
    });
    expect(brands?.options.slice(1).every((option) => !option.checked)).toBe(true);
  });

  it('maps an ebay search with its total count and query-string links', () => {
    const result = ok(ebay, 'ebay');

    expect(result.vendor).toBe('ebay');
    expect(result.totalCount).toBe(1020781);
    expect(result.items[0]).toMatchObject({
      sku: '355928863885',
      relativeUrl: expect.stringMatching(/^ebay-355928863885-ryobi-one-18v-.*\.html$/),
      availability: 'unknown',
      price: { final: { amount: 1082.88 }, regular: { amount: 1985.52 } },
    });
    expect(result.pagination.next).toMatch(/^q=drill&limit=16/);
    expect(result.refinements[0]).toMatchObject({ title: 'Categorías', type: 'text' });
  });

  it('keeps sorts empty when the response carries none (staging never does)', () => {
    expect(ok(priceAsc).sorts).toEqual([]);
  });

  it('maps sorts when the response carries them', () => {
    const payload = structuredClone(amazon);
    (payload.data as Record<string, unknown>).sorts = sortBy.data;

    expect(ok(payload).sorts[0]).toEqual({
      title: 'Destacados',
      link: sortBy.data[0]!.link,
      selected: true,
    });
  });

  it('maps an empty result', () => {
    expect(ok(empty)).toEqual({
      vendor: 'amazon',
      items: [],
      totalCount: 0,
      pagination: { current: 1, totalPages: null, next: null, prev: null, links: [] },
      refinements: [],
      sorts: [],
      skippedItems: 0,
      duplicateItems: 0,
    });
  });
});

describe('parseSearchResponse (tolerance)', () => {
  function withProducts(products: unknown[]) {
    return { ...amazon, data: { ...amazon.data, products } };
  }
  const good = amazon.data.products[0]!;

  it('skips bad items without dropping the page and counts them', () => {
    const result = ok(
      withProducts([
        good,
        { ...good, asin: '' },
        { ...good, title: '  <b></b> ' },
        { ...good, price: { current_price: 0, before_price: 100, currency: 'MXN' } },
        { ...good, price: [] },
        { ...good, price: { current_price: 'abc' } },
        'not an item',
      ]),
    );

    expect(result.items.map((item) => item.sku)).toEqual([good.asin]);
    expect(result.skippedItems).toBe(6);
    expect(result.duplicateItems).toBe(0);
  });

  it('keeps the first of repeated skus so card keys stay unique', () => {
    const result = ok(withProducts([good, { ...good, title: 'Repeated' }]));

    expect(result.items.map((item) => item.name)).toEqual([good.title]);
    expect(result.duplicateItems).toBe(1);
    expect(result.skippedItems).toBe(0);
  });

  it('strips html from titles and degrades optional fields', () => {
    const [item] = ok(
      withProducts([
        {
          asin: 'B000000001',
          title: 'Taladro &amp; <b>broca</b> &quot;pro&quot;',
          brand: 'Bosch',
          price: { current_price: '99.5' },
          image: null,
          reviews: { rating: 0 },
          stock_status: 'out_of_stock',
        },
      ]),
    ).items;

    expect(item).toMatchObject({
      name: 'Taladro & broca "pro"',
      brand: 'Bosch',
      image: null,
      rating: null,
      availability: 'out_of_stock',
      price: { final: { amount: 99.5, currency: 'MXN' }, regular: { amount: 99.5 } },
    });
  });

  it('links cards to the requested store when the responding vendor is not routable', () => {
    const payload = { ...amazon, data: { ...amazon.data, vendor: 'homedepot' } };

    const result = ok(payload, 'amazon');

    expect(result.vendor).toBe('homedepot');
    expect(result.skippedItems).toBe(0);
    for (const item of result.items) {
      expect(item.uid).toBe(`amazon-${item.sku}`);
      expect(parseProductUrl(`/${item.relativeUrl}`, { vendors })).toMatchObject({
        vendor: 'amazon',
        sku: item.sku,
      });
    }
  });

  it('skips every item when neither vendor is routable', () => {
    const payload = { ...amazon, data: { ...amazon.data, vendor: 'homedepot' } };

    const result = ok(payload, 'walmart');

    expect(result.items).toEqual([]);
    expect(result.skippedItems).toBe(amazon.data.products.length);
    expect(result.pagination.next).toBe(amazon.data.pagination.next);
  });

  it('falls back to the requested store when the response has no vendor', () => {
    const payload = { status: 'ok', data: { ...ebay.data, vendor: null } };

    expect(ok(payload, 'ebay').vendor).toBe('ebay');
  });

  it('falls back to the requested store for an unusable vendor instead of dropping the page', () => {
    const payload = { vendor: 'ama-zon', data: { ...amazon.data, vendor: 'ama-zon' } };

    const result = ok(payload, 'amazon');

    expect(result.vendor).toBe('amazon');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.relativeUrl.startsWith('amazon-'))).toBe(true);
  });

  it.each([
    ['a non-object payload', 'oops'],
    ['missing data', { vendor: 'amazon', status: 'error', error: 'boom' }],
    ['data without products', { vendor: 'amazon', data: { pagination: {} } }],
  ])('returns invalid for %s', (_label, payload) => {
    expect(parseSearchResponse(payload, { requestedStore: 'amazon', vendors })).toEqual({
      status: 'invalid',
    });
  });
});

describe('parseSortResponse', () => {
  it('maps the recorded sort_by response', () => {
    const result = parseSortResponse(sortBy);

    expect(result).toEqual({
      status: 'ok',
      data: sortBy.data.map(({ title, link, selected }) => ({ title, link, selected })),
    });
  });

  it('drops options without a link and rejects a payload without a list', () => {
    expect(
      parseSortResponse({
        data: [
          { title: 'A', link: '' },
          { title: 'B', link: '/s?b' },
        ],
      }),
    ).toEqual({ status: 'ok', data: [{ title: 'B', link: '/s?b', selected: false }] });
    expect(parseSortResponse({ data: {} })).toEqual({ status: 'invalid' });
  });
});
