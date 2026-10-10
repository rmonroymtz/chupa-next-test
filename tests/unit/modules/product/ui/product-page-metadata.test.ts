import { describe, expect, it } from 'vitest';
import type { ProductPageDecision } from '@/modules/product/application/product-page-service';
import { buildProductPageMetadata } from '@/modules/product/ui/product-page-metadata';
import { buildMagentoProduct } from '../../../../support/magento-product';

const CANONICAL = 'https://chupaprecios.com.mx/ebay-1|2-camisa.html';

function exists(overrides: Parameters<typeof buildMagentoProduct>[0] = {}): ProductPageDecision {
  return {
    kind: 'magento_product',
    case: 'exists_bot',
    product: buildMagentoProduct(overrides),
    robots: { index: true, follow: true },
    canonicalUrl: CANONICAL,
    copyRequest: null,
  };
}

describe('buildProductPageMetadata — product in Magento', () => {
  it('is indexable with the canonical, Open Graph and Twitter card from Magento data', () => {
    const metadata = buildProductPageMetadata(exists({ metaDescription: '<p>Los mejores.</p>' }));

    expect(metadata).toEqual({
      title: 'Audífonos inalámbricos',
      description: 'Los mejores.',
      robots: { index: true, follow: true },
      alternates: { canonical: CANONICAL },
      openGraph: {
        type: 'website',
        url: CANONICAL,
        title: 'Audífonos inalámbricos',
        description: 'Los mejores.',
        siteName: 'Chupaprecios',
        locale: 'es_MX',
        images: [
          {
            url: 'https://chupaprecios.com.mx/media/catalog/product/a.jpg',
            alt: 'Vista frontal',
          },
          {
            url: 'https://chupaprecios.com.mx/media/catalog/product/b.jpg',
            alt: 'Audífonos inalámbricos',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Audífonos inalámbricos',
        description: 'Los mejores.',
        images: ['https://chupaprecios.com.mx/media/catalog/product/a.jpg'],
      },
    });
  });

  it('prefers the Magento meta title', () => {
    const metadata = buildProductPageMetadata(exists({ metaTitle: 'Audífonos Sony | Oferta' }));
    expect(metadata.title).toBe('Audífonos Sony | Oferta');
    expect(metadata.openGraph?.title).toBe('Audífonos Sony | Oferta');
  });

  it('falls back to the short description when the meta description has no text', () => {
    const metadata = buildProductPageMetadata(
      exists({ metaDescription: '<ul class="a"></ul>', shortDescriptionHtml: '<p>Corta.</p>' }),
    );
    expect(metadata.description).toBe('Corta.');
  });

  it('truncates the description to about 160 characters on a word boundary', () => {
    const long = Array.from({ length: 60 }, (_, i) => `palabra${i}`).join(' ');
    const description = buildProductPageMetadata(exists({ metaDescription: long }))
      .description as string;

    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith('…')).toBe(true);
    expect(long.startsWith(description.slice(0, -1))).toBe(true);
    expect(long.charAt(description.length - 1)).toBe(' ');
  });

  it('omits description and images when Magento has none', () => {
    const metadata = buildProductPageMetadata(
      exists({ metaDescription: null, shortDescriptionHtml: '', images: [] }),
    );
    expect(metadata).not.toHaveProperty('description');
    expect(metadata.openGraph).not.toHaveProperty('images');
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Audífonos inalámbricos',
    });
  });
});

describe('buildProductPageMetadata — other decisions', () => {
  it('missing in Magento: noindex, follow with canonical and no product claims', () => {
    const metadata = buildProductPageMetadata({
      kind: 'missing_product',
      case: 'missing_user',
      robots: { index: false, follow: true },
      canonicalUrl: CANONICAL,
      lookup: { sku: '1|2', vendor: 'ebay' },
      vendor: 'ebay',
      searchUrl: '/search.html?query=camisa&store=ebay',
    });

    expect(metadata).toEqual({
      robots: { index: false, follow: true },
      alternates: { canonical: CANONICAL },
    });
  });

  it('CMS placeholder: noindex, follow', () => {
    expect(
      buildProductPageMetadata({ kind: 'cms', identifier: 'about-us', relativeUrl: 'about-us' }),
    ).toEqual({ robots: { index: false, follow: true } });
  });

  it('redirects and 404s: nothing (handled before rendering)', () => {
    expect(buildProductPageMetadata({ kind: 'not_found', case: null })).toEqual({});
    expect(
      buildProductPageMetadata({ kind: 'redirect', location: '/x.html', permanent: true }),
    ).toEqual({});
  });
});
