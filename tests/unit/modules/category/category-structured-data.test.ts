import { describe, expect, it } from 'vitest';
import type { CategoryProductPage } from '@/modules/category/domain/category';
import {
  buildCategoryBreadcrumbJsonLd,
  buildCategoryCollectionJsonLd,
} from '@/modules/category/ui/category-structured-data';
import type { ProductCard } from '@/modules/product/domain/product';
import { FAKE_CATEGORY } from '../../../support/fakes';

const BASE = 'https://chupaprecios.com.mx';
const CATEGORY_URL = `${BASE}/electronica/computacion/laptops.html`;

const card = (index: number, relativeUrl = `ebay-${index}-laptop.html`): ProductCard => ({
  uid: `uid-${index}`,
  sku: `ebay-${index}`,
  name: `Laptop ${index}`,
  urlKey: relativeUrl.replace(/\.html$/, ''),
  relativeUrl,
  image: null,
  price: null,
  availability: 'in_stock',
});

const listing = (overrides: Partial<CategoryProductPage> = {}): CategoryProductPage => ({
  items: [card(1), card(2)],
  currentPage: 1,
  pageSize: 16,
  totalPages: 1,
  totalCount: 2,
  ...overrides,
});

describe('buildCategoryBreadcrumbJsonLd', () => {
  it('goes Inicio → parent categories → the category, with absolute urls', () => {
    expect(buildCategoryBreadcrumbJsonLd(FAKE_CATEGORY, { baseUrl: `${BASE}/` })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: 'Electrónica', item: `${BASE}/electronica.html` },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Computación',
          item: `${BASE}/electronica/computacion.html`,
        },
        { '@type': 'ListItem', position: 4, name: 'Laptops', item: CATEGORY_URL },
      ],
    });
  });

  it('a top-level category has only Inicio and itself', () => {
    const crumbs = buildCategoryBreadcrumbJsonLd(
      { ...FAKE_CATEGORY, breadcrumbs: [] },
      { baseUrl: BASE },
    ).itemListElement;
    expect(crumbs.map((crumb) => crumb.name)).toEqual(['Inicio', 'Laptops']);
  });
});

describe('buildCategoryCollectionJsonLd', () => {
  it('is a CollectionPage at the clean category url listing the products shown', () => {
    expect(buildCategoryCollectionJsonLd(FAKE_CATEGORY, listing(), { baseUrl: BASE })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Laptops',
      url: CATEGORY_URL,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, url: `${BASE}/ebay-1-laptop.html`, name: 'Laptop 1' },
          { '@type': 'ListItem', position: 2, url: `${BASE}/ebay-2-laptop.html`, name: 'Laptop 2' },
        ],
      },
    });
  });

  it('numbers items by their place in the whole category and keeps the product canonical form', () => {
    const page = listing({
      items: [card(17, 'ebay-1|2-camisa.html')],
      currentPage: 2,
      totalPages: 2,
      totalCount: 17,
    });

    const [item] = buildCategoryCollectionJsonLd(FAKE_CATEGORY, page, { baseUrl: BASE }).mainEntity
      .itemListElement;
    expect(item).toEqual({
      '@type': 'ListItem',
      position: 17,
      url: `${BASE}/ebay-1|2-camisa.html`,
      name: 'Laptop 17',
    });
  });
});
