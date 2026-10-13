import { describe, expect, it } from 'vitest';
import {
  parseSearchProductResult,
  parseVariantsResult,
} from '@/modules/product/infrastructure/chapi-mapper';
import found from '../../../../fixtures/chapi/product.ebay.found.json';
import variants from '../../../../fixtures/chapi/variants.synthetic.json';

function withData(data: Record<string, unknown>) {
  return { ...found, data: { ...found.data, ...data } };
}

describe('parseSearchProductResult', () => {
  it('maps the recorded eBay product, keeping the API price and currency', () => {
    expect(parseSearchProductResult(found)).toEqual({
      status: 'found',
      product: {
        sku: '126981644035|428130345038',
        parentSku: '126981644035',
        vendor: 'ebay',
        title: 'Gildan (6-pack) Black Solid Heavy Cotton Short Sleeve Blank T-Shirt S-3XL',
        brand: 'Gildan',
        descriptionHtml: '<ul class="a-unordered-list a-vertical a-spacing-small"></ul>',
        shortDescription: expect.stringContaining('Choose your favourite colors') as string,
        images: [
          'https://i.ebayimg.com/images/g/4zUAAOSwMlxny9uc/s-l1600.jpg',
          'https://i.ebayimg.com/images/g/EhcAAOSwVq1oL6Uy/s-l1600.jpg',
          'https://i.ebayimg.com/images/g/yqAAAOSwUYZoLpf5/s-l1600.jpg',
        ],
        price: { current: 1145.13, currency: 'MXN', before: null },
        stock: 10,
        availability: 'in_stock',
        itemAvailable: true,
        hasVariants: true,
        deliveryTo: false,
        condition: 'New with tags',
        breadcrumbs: [
          'Clothing, Shoes & Accessories',
          'Men',
          "Men's Clothing",
          'Shirts',
          'T-Shirts',
        ],
        categories: [
          'Clothing, Shoes & Accessories',
          'Men',
          "Men's Clothing",
          'Shirts',
          'T-Shirts',
        ],
      },
    });
  });

  it('keeps a previous price when the API sends one', () => {
    const result = parseSearchProductResult(
      withData({ price: { current_price: 10, currency: 'MXN', before_price: 12.5 } }),
    );

    expect(result.status === 'found' && result.product.price).toEqual({
      current: 10,
      currency: 'MXN',
      before: 12.5,
    });
  });

  it('reads the USD price variant as returned', () => {
    const result = parseSearchProductResult(
      withData({ price: { usd_current_price: 9.99, usd_currency: 'USD', usd_before_price: 0 } }),
    );

    expect(result.status === 'found' && result.product.price).toEqual({
      current: 9.99,
      currency: 'USD',
      before: null,
    });
  });

  it('maps an empty price array to no price', () => {
    const result = parseSearchProductResult(withData({ price: [] }));

    expect(result.status === 'found' && result.product.price).toBeNull();
  });

  it.each([
    ['empty array', []],
    ['empty object', {}],
    ['null', null],
  ])('maps data as %s to not_found', (_label, data) => {
    expect(parseSearchProductResult({ vendor: 'ebay', status: 'ok', data })).toEqual({
      status: 'not_found',
    });
  });

  it('maps a missing data field to not_found', () => {
    expect(parseSearchProductResult({ vendor: 'ebay', status: 'error' })).toEqual({
      status: 'not_found',
    });
  });

  it.each([
    ['a non-object payload', 'oops'],
    ['data without an asin', { vendor: 'ebay', data: { title: 'x' } }],
    ['a non-numeric price', withData({ price: { current_price: '10', currency: 'MXN' } })],
  ])('maps %s to an invalid_response error', (_label, payload) => {
    expect(parseSearchProductResult(payload)).toEqual({
      status: 'error',
      reason: 'invalid_response',
    });
  });
});

describe('parseSearchProductResult with malformed optional fields', () => {
  it.each([
    ['an empty price object', { price: {} }, 'price', null],
    ['a price without amount', { price: { currency: 'MXN' } }, 'price', null],
    ['a non-integer stock', { stock: 2.5 }, 'stock', null],
    ['a string stock', { stock: 'many' }, 'stock', null],
    ['a non-string brand', { brand: 42 }, 'brand', null],
    ['non-boolean flags', { has_variants: 'yes' }, 'hasVariants', false],
    ['a non-array categories', { categories: 'Men' }, 'categories', []],
    ['a non-string breadcrumbs', { breadcrumbs: ['Men'] }, 'breadcrumbs', []],
    ['a non-string description', { description: { html: 'x' } }, 'descriptionHtml', ''],
  ])('degrades %s instead of failing the product', (_label, data, field, expected) => {
    const result = parseSearchProductResult(withData(data));

    expect(result.status).toBe('found');
    expect(result.status === 'found' && result.product[field as 'price']).toEqual(expected);
  });

  it('keeps the valid thumbnails and drops odd entries', () => {
    const result = parseSearchProductResult(
      withData({
        main_image: 'https://i.ebayimg.com/a.jpg',
        image: null,
        thumbnails: [
          { link: 'https://i.ebayimg.com/b.jpg' },
          { url: 'x' },
          'c.jpg',
          null,
          { link: 7 },
        ],
      }),
    );

    expect(result.status === 'found' && result.product.images).toEqual([
      'https://i.ebayimg.com/a.jpg',
      'https://i.ebayimg.com/b.jpg',
    ]);
  });

  it('ignores a thumbnails value that is not an array', () => {
    const result = parseSearchProductResult(
      withData({ main_image: 'https://i.ebayimg.com/a.jpg', image: null, thumbnails: 'oops' }),
    );

    expect(result.status === 'found' && result.product.images).toEqual([
      'https://i.ebayimg.com/a.jpg',
    ]);
  });

  it.each([
    ['a missing title', { title: undefined }],
    ['a numeric title', { title: 5 }],
    ['an empty asin', { asin: '' }],
    ['a null current price', { price: { current_price: null, currency: 'MXN' } }],
    ['a string USD price', { price: { usd_current_price: '9.99' } }],
  ])('still rejects %s (core field)', (_label, data) => {
    expect(parseSearchProductResult(withData(data))).toEqual({
      status: 'error',
      reason: 'invalid_response',
    });
  });
});

describe('parseVariantsResult', () => {
  it('maps variant dimensions and options', () => {
    expect(parseVariantsResult(variants)).toEqual({
      status: 'found',
      product: {
        sku: 'B0TEST',
        vendor: 'amazon',
        dimensions: [
          {
            dimension: 'size',
            type: 'button',
            options: [
              { title: 'M', sku: 'B0TEST', image: null, selected: true, available: true },
              { title: 'L', sku: 'B0TESTL', image: null, selected: false, available: false },
            ],
          },
        ],
      },
    });
  });

  it('maps a payload without an asin to not_found', () => {
    expect(parseVariantsResult({ vendor: 'amazon', status: 'error', variants: [] })).toEqual({
      status: 'not_found',
    });
  });

  it('maps a malformed payload to invalid_response', () => {
    expect(
      parseVariantsResult({ asin: 'B0', vendor: 'amazon', variants: [{ options: 3 }] }),
    ).toEqual({
      status: 'error',
      reason: 'invalid_response',
    });
  });
});
