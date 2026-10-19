import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryProductPage } from '@/modules/category/domain/category';
import { CategoryPage } from '@/modules/category/ui/category-page';
import type { ProductCard } from '@/modules/product/domain/product';
import { FAKE_CATEGORY } from '../../../support/fakes';

// The Page Builder pipeline has its own tests; here it only echoes what it receives.
vi.mock('@/modules/page-builder/ui/page-builder-content', () => ({
  PageBuilderContent: ({ content, source }: { content: string; source: string }) => (
    <section data-source={source} dangerouslySetInnerHTML={{ __html: content }} />
  ),
}));

// The site origin comes from the validated environment in production.
vi.mock('@/modules/seo/infrastructure/site-config', () => ({
  getSiteConfig: () => ({ baseUrl: 'https://chupaprecios.com.mx', logoUrl: null, sameAs: [] }),
}));

const CLEAN_URL = '/electronica/computacion/laptops.html';
const BASE = 'https://chupaprecios.com.mx';

const card = (index: number): ProductCard => ({
  uid: `uid-${index}`,
  sku: `ebay-${index}`,
  name: `Laptop ${index}`,
  urlKey: `ebay-${index}-laptop`,
  relativeUrl: `ebay-${index}-laptop.html`,
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

const render = (page: CategoryProductPage, search = '', category = FAKE_CATEGORY) =>
  renderToStaticMarkup(<CategoryPage category={category} listing={page} search={search} />);

/** Pagination links in document order: [href or null for the current page, text]. */
const paginationLinks = (html: string) => {
  const nav = /<nav aria-label="Paginación"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
  return [...nav.matchAll(/<(a|span)\b([^>]*)>([^<]*)<\/\1>/g)].map(([, tag, attrs, text]) => [
    tag === 'a' ? (/href="([^"]*)"/.exec(attrs ?? '')?.[1] ?? '').replaceAll('&amp;', '&') : null,
    text,
  ]);
};

/** Breadcrumb entries in document order: [href or null for the current category, text]. */
const breadcrumbs = (html: string) => {
  const nav = /<nav aria-label="Ruta de navegación"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
  return [...nav.matchAll(/<(a|span)\b([^>]*)>([^<]*)<\/\1>/g)]
    .filter(([, , attrs]) => !(attrs ?? '').includes('aria-hidden'))
    .map(([, tag, attrs, text]) => [
      tag === 'a' ? (/href="([^"]*)"/.exec(attrs ?? '')?.[1] ?? '') : null,
      text,
    ]);
};

/** Parsed JSON-LD blocks of the markup, by `@type`. */
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(
    ([, json]) => JSON.parse(json ?? '') as { '@type': string; [key: string]: unknown },
  );

describe('CategoryPage', () => {
  it('lays the page on the canonical grid container, aligned with the header', () => {
    const root =
      /<div data-category-uid="[^"]*" class="([^"]*)"/.exec(render(listing()))?.[1] ?? '';
    expect(root.split(' ')).toContain('container-padded');
    expect(root).not.toMatch(/max-w-|px-4/);
  });

  it('shows the breadcrumb trail: Inicio, parent categories, then the current one unlinked', () => {
    const html = render(listing());

    expect(breadcrumbs(html)).toEqual([
      ['/', 'Inicio'],
      ['/electronica.html', 'Electrónica'],
      ['/electronica/computacion.html', 'Computación'],
      [null, 'Laptops'],
    ]);
    expect(html).toMatch(/<span aria-current="page"[^>]*>Laptops<\/span>/);
  });

  it('describes an indexable category with BreadcrumbList and CollectionPage JSON-LD', () => {
    const blocks = jsonLd(render(listing()));

    expect(blocks.map((block) => block['@type'])).toEqual(['BreadcrumbList', 'CollectionPage']);
    expect(blocks[1]).toMatchObject({
      url: `${BASE}${CLEAN_URL}`,
      mainEntity: {
        itemListElement: [
          { position: 1, url: `${BASE}/ebay-1-laptop.html`, name: 'Laptop 1' },
          { position: 2, url: `${BASE}/ebay-2-laptop.html`, name: 'Laptop 2' },
        ],
      },
    });
  });

  it('an empty (noindex) category keeps its breadcrumbs but has no structured data', () => {
    const html = render(listing({ items: [], totalPages: 0, totalCount: 0 }));

    expect(breadcrumbs(html)).toHaveLength(4);
    expect(jsonLd(html)).toEqual([]);
  });

  it('shows the category name as h1, its description and a card per product', () => {
    const html = render(listing());

    expect(html).toContain('>Laptops</h1>');
    expect(html).toContain(
      `<section data-source="category:${FAKE_CATEGORY.uid}"><p>Las mejores <strong>laptops</strong> al mejor precio.</p></section>`,
    );
    expect(html).toContain('href="/ebay-1-laptop.html"');
    expect(html).toContain('href="/ebay-2-laptop.html"');
    expect(html).toContain('Laptop 2');
    expect(html).not.toContain('Paginación');
  });

  it('leaves the description out when Magento has none', () => {
    const html = render(listing(), '', { ...FAKE_CATEGORY, description: null });

    expect(html).not.toContain('data-source=');
  });

  it('shows an empty state instead of the grid when the category has no products', () => {
    const html = render(listing({ items: [], totalPages: 0, totalCount: 0 }));

    expect(html).toContain('No hay productos en esta categoría.');
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('Paginación');
  });

  it('links every page with ?page=N, the first page to the clean url, keeping other params', () => {
    const html = render(
      listing({ currentPage: 2, totalPages: 3, totalCount: 40 }),
      'page=2&utm_source=x',
    );

    expect(paginationLinks(html)).toEqual([
      [`${CLEAN_URL}?utm_source=x`, 'Anterior'],
      [`${CLEAN_URL}?utm_source=x`, '1'],
      [null, '2'],
      [`${CLEAN_URL}?page=3&utm_source=x`, '3'],
      [`${CLEAN_URL}?page=3&utm_source=x`, 'Siguiente'],
    ]);
    expect(html).toContain('aria-current="page"');
  });

  it('collapses distant pages and has no previous link on the first page', () => {
    const html = render(listing({ currentPage: 1, totalPages: 9, totalCount: 140 }));

    expect(paginationLinks(html)).toEqual([
      [null, '1'],
      [`${CLEAN_URL}?page=2`, '2'],
      [null, '…'],
      [`${CLEAN_URL}?page=9`, '9'],
      [`${CLEAN_URL}?page=2`, 'Siguiente'],
    ]);
  });

  it('has no next link on the last page', () => {
    const html = render(listing({ currentPage: 9, totalPages: 9, totalCount: 140 }), 'page=9');

    expect(paginationLinks(html)).toEqual([
      [`${CLEAN_URL}?page=8`, 'Anterior'],
      [CLEAN_URL, '1'],
      [null, '…'],
      [`${CLEAN_URL}?page=8`, '8'],
      [null, '9'],
    ]);
  });
});
