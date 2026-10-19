// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { SearchPageDecision } from '@/modules/search/application/search-page';
import type { SearchItem } from '@/modules/search/domain/search-result';
import { SearchPage } from '@/modules/search/ui/search-page';

type View = Extract<SearchPageDecision, { kind: 'page' }>;

const item = (index: number, overrides: Partial<SearchItem> = {}): SearchItem => ({
  uid: `amazon-${index}`,
  sku: `B00000000${index}`,
  name: `Taladro ${index}`,
  urlKey: `amazon-B00000000${index}-taladro-${index}`,
  relativeUrl: `amazon-B00000000${index}-taladro-${index}.html`,
  image: null,
  price: null,
  availability: 'in_stock',
  brand: null,
  rating: null,
  ...overrides,
});

const view = (items: readonly SearchItem[]): View => ({
  kind: 'page',
  query: 'taladro',
  store: 'amazon',
  page: null,
  storeParams: '',
  results: {
    kind: 'single',
    listing: {
      store: 'amazon',
      pageSize: 16,
      filters: '',
      failure: null,
      servedByFallback: false,
      result: {
        vendor: 'amazon',
        items,
        totalCount: items.length,
        pagination: { current: 1, totalPages: null, next: null, prev: null, links: [] },
        refinements: [],
        sorts: [],
        skippedItems: 0,
        duplicateItems: 0,
      },
    },
  },
});

afterEach(() => {
  document.body.innerHTML = '';
});

function render(items: readonly SearchItem[]) {
  document.body.innerHTML = renderToStaticMarkup(
    <SearchPage
      view={view(items)}
      retryUrl="/search.html"
      loadSortOptions={() => Promise.resolve([])}
    />,
  );
  return document.body;
}

describe('SearchPage single-store grid', () => {
  it('lists the results in the shared PWA Gallery grid with the shared card', () => {
    const body = render([item(1), item(2)]);

    const list = body.querySelector('ul[data-slot="product-grid"]');
    expect(list?.className).toContain('min-[800px]:grid-cols-4');
    expect(
      [...(list?.querySelectorAll<HTMLAnchorElement>('li > a') ?? [])].map((a) => a.dataset.slot),
    ).toEqual(['product-card', 'product-card']);
  });

  it('shows the brand and the review stars of a result, as the PWA Gallery item does', () => {
    const body = render([item(1, { brand: 'DEWALT', rating: 4.5 }), item(2)]);

    const [first, second] = [...body.querySelectorAll('ul[data-slot="product-grid"] > li')];
    expect(first?.querySelector('[data-slot="product-card-brand"]')?.textContent).toBe('DEWALT');
    expect(first?.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Calificación: 4.5 de 5 estrellas',
    );
    expect(second?.querySelector('[role="img"]')).toBeNull();
  });
});
