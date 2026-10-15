import { describe, expect, it } from 'vitest';
import {
  mapProductRoute,
  type ProductRouteDto,
} from '@/modules/product/infrastructure/magento-product-mapper';
import fixture from '../../../../fixtures/magento/product-by-route.simple.json';

const recorded = fixture.data.route as ProductRouteDto;
const URL = recorded.relative_url as string;

function configurable(overrides: Partial<ProductRouteDto> = {}): ProductRouteDto {
  return {
    ...recorded,
    __typename: 'ConfigurableProduct',
    media_gallery: [
      { url: 'https://m.test/b.jpg', label: 'B', position: 2, disabled: false },
      { url: 'https://m.test/hidden.jpg', label: null, position: 0, disabled: true },
      { url: 'https://m.test/a.jpg', label: '', position: 1, disabled: false },
    ],
    categories: [
      {
        uid: 'Mw==',
        name: 'T-Shirts',
        url_path: 'men/t-shirts',
        breadcrumbs: [{ category_uid: 'Mg==', category_name: 'Men', category_url_path: 'men' }],
      },
    ],
    configurable_options: [
      {
        uid: 'opt',
        attribute_code: 'size',
        label: 'Size',
        position: 0,
        values: [{ uid: 'v1', label: 'M', value_index: 10 }],
      },
    ],
    variants: [
      {
        attributes: [{ uid: 'a', code: 'size', label: 'M', value_index: 10 }],
        product: {
          uid: 'child',
          sku: 'child-sku',
          name: 'Child',
          stock_status: 'OUT_OF_STOCK',
          price_range: {
            minimum_price: {
              final_price: { value: 10, currency: 'MXN' },
              regular_price: { value: 12, currency: 'MXN' },
            },
          },
        },
      },
    ],
    related_products: [
      {
        uid: 'rel',
        sku: 'amazon-sku',
        name: 'Alternative',
        url_key: 'amazon-B0-alternative',
        url_suffix: '.html',
        small_image: { url: 'https://m.test/s.jpg', label: 'Alt' },
        price_range: { minimum_price: { final_price: { value: 99.5, currency: 'MXN' } } },
      },
      { uid: 'broken', sku: null, name: null, url_key: null },
    ],
    ...overrides,
  };
}

describe('mapProductRoute', () => {
  it('maps the recorded simple product', () => {
    expect(mapProductRoute(recorded, URL)).toEqual({
      kind: 'product',
      product: {
        uid: 'NzY2MzExOTA4',
        typename: 'SimpleProduct',
        sku: '126981644035|428130345038',
        name: 'Gildan (6-pack) Black Solid Heavy Cotton Short Sleeve Blank T-Shirt S-3XL',
        urlKey:
          'ebay-126981644035|428130345038-gildan-6-pack-black-solid-heavy-cotton-short-sleeve-blank-t-shirt-s-3xl',
        urlSuffix: '.html',
        relativeUrl: URL,
        descriptionHtml: '',
        shortDescriptionHtml: expect.stringContaining('Choose your favourite colors') as string,
        metaTitle: null,
        metaDescription: '<ul class="a-unordered-list a-vertical a-spacing-small"></ul>',
        images: [
          {
            url: expect.stringContaining('/media/catalog/product/') as string,
            label: 'Gildan (6-pack) Black Solid Heavy Cotton Short Sleeve Blank T-Shirt S-3XL',
          },
        ],
        price: {
          final: { amount: 1145.13, currency: 'MXN' },
          regular: { amount: 1145.13, currency: 'MXN' },
          discount: { amountOff: 0, percentOff: 0 },
        },
        availability: 'in_stock',
        categories: [],
        deliveryTo: false,
        productStatus: null,
        brand: null,
        configurableOptions: [],
        variants: [],
        related: [],
      },
    });
  });

  it('maps a missing url key to empty and omits a missing url suffix (production placeholder)', () => {
    const result = mapProductRoute(
      { ...recorded, url_key: null, url_suffix: null } as ProductRouteDto,
      URL,
    );

    expect(result.kind === 'product' && result.product.urlKey).toBe('');
    expect(result.kind === 'product' && result.product).not.toHaveProperty('urlSuffix');
  });

  it('keeps enabled images sorted by position and blank labels as null', () => {
    const result = mapProductRoute(configurable(), URL);

    expect(result.kind === 'product' && result.product.images).toEqual([
      { url: 'https://m.test/a.jpg', label: null },
      { url: 'https://m.test/b.jpg', label: 'B' },
    ]);
  });

  it('maps categories with breadcrumbs', () => {
    const result = mapProductRoute(configurable(), URL);

    expect(result.kind === 'product' && result.product.categories).toEqual([
      { name: 'T-Shirts', urlPath: 'men/t-shirts', breadcrumbs: [{ name: 'Men', urlPath: 'men' }] },
    ]);
  });

  it('maps configurable options and variants', () => {
    const result = mapProductRoute(configurable(), URL);
    if (result.kind !== 'product') throw new Error('expected product');

    expect(result.product.configurableOptions).toEqual([
      {
        uid: 'opt',
        attributeCode: 'size',
        label: 'Size',
        values: [{ uid: 'v1', label: 'M', valueIndex: 10 }],
      },
    ]);
    expect(result.product.variants).toEqual([
      {
        uid: 'child',
        sku: 'child-sku',
        name: 'Child',
        availability: 'out_of_stock',
        price: { final: { amount: 10, currency: 'MXN' }, regular: { amount: 12, currency: 'MXN' } },
        attributes: [{ code: 'size', label: 'M', valueIndex: 10 }],
      },
    ]);
  });

  it('maps related products as alternatives and drops incomplete ones', () => {
    const result = mapProductRoute(configurable(), URL);

    expect(result.kind === 'product' && result.product.related).toEqual([
      {
        uid: 'rel',
        sku: 'amazon-sku',
        name: 'Alternative',
        relativeUrl: 'amazon-B0-alternative.html',
        image: { url: 'https://m.test/s.jpg', label: 'Alt' },
        price: { amount: 99.5, currency: 'MXN' },
      },
    ]);
  });

  it('returns not_found for a null route or an entity without its identifier', () => {
    expect(mapProductRoute(null, URL)).toEqual({ kind: 'not_found' });
    expect(
      mapProductRoute({ type: 'CMS_PAGE', redirect_code: 0, relative_url: 'about-us' }, 'about-us'),
    ).toEqual({ kind: 'not_found' });
    expect(mapProductRoute({ type: null, redirect_code: 0 }, 'x.html')).toEqual({
      kind: 'not_found',
    });
  });

  it('reports CMS pages and categories so the page can dispatch them', () => {
    expect(
      mapProductRoute(
        { type: 'CMS_PAGE', redirect_code: 0, relative_url: 'about-us', identifier: 'about-us' },
        'about-us',
      ),
    ).toEqual({ kind: 'cms', identifier: 'about-us', relativeUrl: 'about-us' });
    expect(
      mapProductRoute(
        { type: 'CATEGORY', redirect_code: 0, relative_url: 'men.html', uid: 'MTI=' },
        'men.html',
      ),
    ).toEqual({ kind: 'category', uid: 'MTI=', relativeUrl: 'men.html' });
  });

  it.each([
    ['an empty relative_url', ''],
    ['a null relative_url', null],
    ['the requested url', URL],
  ])('ignores a redirect with %s and resolves the product (R3-003)', (_label, relativeUrl) => {
    const result = mapProductRoute(
      { ...recorded, redirect_code: 301, relative_url: relativeUrl },
      URL,
    );

    expect(result.kind).toBe('product');
  });

  it('maps a self-redirect without an entity to not_found (R3-003)', () => {
    expect(
      mapProductRoute({ type: null, redirect_code: 302, relative_url: 'x.html' }, 'x.html'),
    ).toEqual({
      kind: 'not_found',
    });
  });

  it('returns a redirect when Magento reports a redirect code', () => {
    expect(
      mapProductRoute({ ...recorded, redirect_code: 301, relative_url: 'new.html' }, URL),
    ).toEqual({
      kind: 'redirect',
      relativeUrl: 'new.html',
      code: 301,
    });
  });

  it('maps unknown stock status to unknown availability', () => {
    const result = mapProductRoute({ ...recorded, stock_status: null }, URL);

    expect(result.kind === 'product' && result.product.availability).toBe('unknown');
  });
});
