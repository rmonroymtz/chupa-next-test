import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryProductPage } from '@/modules/category/domain/category';
import { CategoryPage } from '@/modules/category/ui/category-page';
import type { ProductCard } from '@/modules/product/domain/product';
import { FAKE_CATEGORY } from '../../../../support/fakes';

vi.mock('@/modules/page-builder/ui/page-builder-content', () => ({
  PageBuilderContent: () => null,
}));
vi.mock('@/modules/seo/infrastructure/site-config', () => ({
  getSiteConfig: () => ({ baseUrl: 'https://chupaprecios.com.mx', logoUrl: null, sameAs: [] }),
}));

const card = (index: number): ProductCard => ({
  uid: `uid-${index}`,
  sku: `ebay-${index}`,
  name: `Laptop ${index}`,
  urlKey: `ebay-${index}-laptop`,
  relativeUrl: `ebay-${index}-laptop.html`,
  image: null,
  price: {
    final: { amount: 9000, currency: 'MXN' },
    regular: { amount: 9000, currency: 'MXN' },
    discount: null,
  },
  availability: 'in_stock',
});

const listing: CategoryProductPage = {
  items: [card(1), card(2)],
  currentPage: 1,
  pageSize: 16,
  totalPages: 1,
  totalCount: 2,
};

describe('CategoryPage product grid', () => {
  it('lists the products in the shared PWA Gallery grid with the shared card', () => {
    const html = renderToStaticMarkup(
      <CategoryPage category={FAKE_CATEGORY} listing={listing} search="" />,
    );

    expect(html).toMatch(/<ul data-slot="product-grid" class="[^"]*min-\[800px\]:grid-cols-4/);
    expect(
      html.match(/<a href="\/ebay-\d-laptop\.html"[^>]*data-slot="product-card"/g),
    ).toHaveLength(2);
    // No discount: the regular price is not struck through.
    expect(html).toContain('$9,000.00');
    expect(html).not.toContain('data-price="compare-at"');
  });
});
