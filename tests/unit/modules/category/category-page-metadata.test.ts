import { describe, expect, it } from 'vitest';
import { buildCategoryPageMetadata } from '@/modules/category/ui/category-page-metadata';
import { FAKE_CATEGORY } from '../../../support/fakes';

const CANONICAL = 'https://chupaprecios.com.mx/electronica/computacion/laptops.html';

describe('buildCategoryPageMetadata', () => {
  it('is indexable with canonical, Magento meta title (site name stripped), description and Open Graph', () => {
    expect(
      buildCategoryPageMetadata(FAKE_CATEGORY, { canonicalUrl: CANONICAL, indexable: true }),
    ).toEqual({
      title: 'Laptops',
      description: 'Compra laptops importadas con envío a todo México.',
      robots: { index: true, follow: true },
      alternates: { canonical: CANONICAL },
      openGraph: {
        type: 'website',
        url: CANONICAL,
        title: 'Laptops',
        description: 'Compra laptops importadas con envío a todo México.',
        siteName: 'Chupaprecios',
        locale: 'es_MX',
      },
    });
  });

  it('is noindex, follow when the category must not be indexed (no products)', () => {
    const metadata = buildCategoryPageMetadata(FAKE_CATEGORY, {
      canonicalUrl: CANONICAL,
      indexable: false,
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({ canonical: CANONICAL });
  });

  it('falls back to the category name when the meta title is only the site name', () => {
    const metadata = buildCategoryPageMetadata(
      { ...FAKE_CATEGORY, metaTitle: 'Chupaprecios' },
      { canonicalUrl: CANONICAL, indexable: true },
    );

    expect(metadata.title).toBe('Laptops');
    expect(metadata.openGraph?.title).toBe('Laptops');
  });

  it('falls back to the category name and omits a missing description', () => {
    const metadata = buildCategoryPageMetadata(
      { ...FAKE_CATEGORY, metaTitle: null, metaDescription: null },
      { canonicalUrl: CANONICAL, indexable: true },
    );

    expect(metadata.title).toBe('Laptops');
    expect(metadata).not.toHaveProperty('description');
    expect(metadata.openGraph).not.toHaveProperty('description');
  });

  it('turns an HTML meta description into one plain-text line of at most 160 characters', () => {
    const metadata = buildCategoryPageMetadata(
      { ...FAKE_CATEGORY, metaDescription: `<p>Laptops   ${'muy baratas '.repeat(20)}</p>` },
      { canonicalUrl: CANONICAL, indexable: true },
    );

    expect(metadata.description).toMatch(/^Laptops muy baratas .*…$/);
    expect(String(metadata.description).length).toBeLessThanOrEqual(160);
  });
});
