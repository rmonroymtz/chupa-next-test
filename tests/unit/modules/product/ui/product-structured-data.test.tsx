import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getDisplayPrice } from '@/modules/product/domain/display-price';
import { formatPrice } from '@/modules/product/ui/format-price';
import { MagentoProductPrice } from '@/modules/product/ui/magento-product-price';
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  toSchemaAvailability,
} from '@/modules/product/ui/product-structured-data';
import { buildMagentoProduct } from '../../../../support/magento-product';

const BASE = 'https://chupaprecios.com.mx';
const CANONICAL = `${BASE}/ebay-1|2-camisa.html`;
const mxn = (amount: number) => ({ amount, currency: 'MXN' });

describe('toSchemaAvailability', () => {
  it.each([
    ['in_stock', 'https://schema.org/InStock'],
    ['out_of_stock', 'https://schema.org/OutOfStock'],
    ['unknown', undefined],
  ] as const)('%s → %s', (availability, expected) => {
    expect(toSchemaAvailability(availability)).toBe(expected);
  });
});

describe('buildProductJsonLd', () => {
  it('describes a Magento product with its offer', () => {
    const product = buildMagentoProduct({ brand: 'Sony' });

    expect(buildProductJsonLd(product, CANONICAL)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Audífonos inalámbricos',
      sku: 'B0TESTSKU1',
      image: [
        'https://chupaprecios.com.mx/media/catalog/product/a.jpg',
        'https://chupaprecios.com.mx/media/catalog/product/b.jpg',
      ],
      description: 'Audífonos con cancelación de ruido.',
      brand: { '@type': 'Brand', name: 'Sony' },
      url: CANONICAL,
      offers: {
        '@type': 'Offer',
        price: 1299.5,
        priceCurrency: 'MXN',
        availability: 'https://schema.org/InStock',
        url: CANONICAL,
      },
    });
  });

  it('marks out-of-stock products OutOfStock', () => {
    const jsonLd = buildProductJsonLd(
      buildMagentoProduct({ availability: 'out_of_stock' }),
      CANONICAL,
    );
    expect(jsonLd.offers?.availability).toBe('https://schema.org/OutOfStock');
  });

  it('omits brand, description, images and offer when Magento has none', () => {
    const jsonLd = buildProductJsonLd(
      buildMagentoProduct({
        price: null,
        images: [],
        descriptionHtml: '',
        shortDescriptionHtml: '<ul></ul>',
        availability: 'unknown',
      }),
      CANONICAL,
    );
    expect(jsonLd).not.toHaveProperty('brand');
    expect(jsonLd).not.toHaveProperty('description');
    expect(jsonLd).not.toHaveProperty('image');
    expect(jsonLd).not.toHaveProperty('offers');
  });

  it('falls back to the short description as plain text', () => {
    const jsonLd = buildProductJsonLd(
      buildMagentoProduct({ descriptionHtml: '', shortDescriptionHtml: '<p>Uno</p><p>Dos</p>' }),
      CANONICAL,
    );
    expect(jsonLd.description).toBe('Uno Dos');
  });
});

describe('price parity (visible price === JSON-LD offer price)', () => {
  it.each([
    ['no discount', { final: mxn(1145.13), regular: mxn(1145.13), discount: null }],
    [
      'discount',
      { final: mxn(899), regular: mxn(1299), discount: { amountOff: 400, percentOff: 30.79 } },
    ],
    ['regular below final', { final: mxn(500), regular: mxn(450), discount: null }],
  ])('%s', (_case, price) => {
    const product = buildMagentoProduct({ price });
    const offer = buildProductJsonLd(product, CANONICAL).offers!;
    const visible = renderToStaticMarkup(<MagentoProductPrice product={product} />);
    const display = getDisplayPrice(product)!;

    expect(offer.price).toBe(display.amount);
    expect(offer.price).toBe(price.final.amount);
    expect(offer.priceCurrency).toBe(display.currency);
    // The first (current) amount rendered is the offer price.
    const [current] = visible.match(/\$[\d,]+\.\d{2}/g) ?? [];
    expect(current).toBe(formatPrice(offer.price, offer.priceCurrency));
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('goes Inicio → deepest category path (category pages) → product, with absolute urls', () => {
    const product = buildMagentoProduct({
      categories: [
        { name: 'Electrónica', urlPath: 'electronica', breadcrumbs: [] },
        {
          name: 'Audífonos',
          urlPath: 'electronica/audio/audifonos',
          breadcrumbs: [
            { name: 'Electrónica', urlPath: 'electronica' },
            { name: 'Audio', urlPath: 'electronica/audio' },
          ],
        },
      ],
    });

    expect(buildBreadcrumbJsonLd(product, { baseUrl: BASE, canonicalUrl: CANONICAL })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${BASE}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Electrónica',
          item: `${BASE}/electronica.html`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Audio',
          item: `${BASE}/electronica/audio.html`,
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'Audífonos',
          item: `${BASE}/electronica/audio/audifonos.html`,
        },
        { '@type': 'ListItem', position: 5, name: 'Audífonos inalámbricos', item: CANONICAL },
      ],
    });
  });

  it('uses the store category suffix when given', () => {
    const product = buildMagentoProduct({
      categories: [{ name: 'Moda', urlPath: 'moda', breadcrumbs: [] }],
    });

    const crumbs = buildBreadcrumbJsonLd(product, {
      baseUrl: `${BASE}/`,
      canonicalUrl: CANONICAL,
      categoryUrlSuffix: '',
    }).itemListElement;
    expect(crumbs[1]).toMatchObject({ name: 'Moda', item: `${BASE}/moda` });
  });

  it('skips categories without a url path and works without categories', () => {
    const product = buildMagentoProduct({
      categories: [
        {
          name: 'Ropa',
          urlPath: null,
          breadcrumbs: [{ name: 'Moda', urlPath: 'moda' }],
        },
      ],
    });
    const names = buildBreadcrumbJsonLd(product, {
      baseUrl: BASE,
      canonicalUrl: CANONICAL,
    }).itemListElement.map((item) => item.name);
    expect(names).toEqual(['Inicio', 'Moda', 'Audífonos inalámbricos']);

    const bare = buildBreadcrumbJsonLd(buildMagentoProduct(), {
      baseUrl: BASE,
      canonicalUrl: CANONICAL,
    });
    expect(bare.itemListElement.map((item) => item.position)).toEqual([1, 2]);
  });
});
