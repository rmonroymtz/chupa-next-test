// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  SearchPageDecision,
  SearchResults,
  StoreListing,
} from '@/modules/search/application/search-page';
import type {
  SearchItem,
  SearchResult,
  SearchSortOption,
} from '@/modules/search/domain/search-result';
import { SearchPage, type SortOptionsLoader } from '@/modules/search/ui/search-page';

type View = Extract<SearchPageDecision, { kind: 'page' }>;

const RETRY = '/search.html?query=taladro&store=amazon';

const item = (index: number): SearchItem => ({
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
});

const result = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  vendor: 'amazon',
  items: [item(1), item(2)],
  totalCount: 2,
  pagination: { current: 1, totalPages: null, next: null, prev: null, links: [] },
  refinements: [],
  sorts: [],
  skippedItems: 0,
  duplicateItems: 0,
  ...overrides,
});

const listing = (overrides: Partial<StoreListing> = {}): StoreListing => ({
  store: 'amazon',
  pageSize: 16,
  filters: '',
  result: result(),
  failure: null,
  servedByFallback: false,
  ...overrides,
});

const view = (results: SearchResults, overrides: Partial<View> = {}): View => ({
  kind: 'page',
  query: 'taladro',
  store: 'amazon',
  page: null,
  storeParams: '',
  results,
  ...overrides,
});

const single = (overrides: Partial<StoreListing> = {}, viewOverrides: Partial<View> = {}) =>
  view({ kind: 'single', listing: listing(overrides) }, viewOverrides);

const SORTS: readonly SearchSortOption[] = [
  { title: 'Precio: Del más bajo al más alto', link: '/s?s=price-asc', selected: false },
  { title: 'Destacados', link: '/s?s=relevance', selected: true },
];

const noSorts: SortOptionsLoader = () => Promise.resolve([]);

afterEach(() => {
  document.body.innerHTML = '';
});

/** Renders synchronously: suspended boundaries show their fallback. */
function render(pageView: View, loadSortOptions: SortOptionsLoader = noSorts) {
  document.body.innerHTML = renderToStaticMarkup(
    <SearchPage view={pageView} retryUrl={RETRY} loadSortOptions={loadSortOptions} />,
  );
  return document.body;
}

/** Renders after every suspended boundary resolved (what the stream ends with). */
async function renderAll(pageView: View, loadSortOptions: SortOptionsLoader) {
  const { prelude } = await prerender(
    <SearchPage view={pageView} retryUrl={RETRY} loadSortOptions={loadSortOptions} />,
  );
  document.body.innerHTML = await new Response(prelude).text();
  return document.body;
}

const params = (href: string | null) =>
  Object.fromEntries(new URL(href ?? '', 'https://x.test').searchParams.entries());

const links = (root: ParentNode, selector: string) =>
  [...root.querySelectorAll<HTMLAnchorElement>(`${selector} a`)].map((a) => ({
    text: a.textContent,
    ...params(a.getAttribute('href')),
  }));

describe('SearchPage: store switching', () => {
  it('renders no on-page store tabs: the header search bar switches stores, as in the legacy PWA', () => {
    expect(render(single()).querySelector('nav[aria-label="Tiendas"]')).toBeNull();
  });

  it.each([
    ['bots', { kind: 'none', reason: 'bot' } as const],
    ['a blank query', { kind: 'none', reason: 'empty_query' } as const],
  ])('has no tabs, sort, filters or results for %s', (_, results) => {
    const loader = vi.fn(noSorts);
    const body = render(view(results), loader);

    expect(body.querySelector('nav')).toBeNull();
    expect(body.querySelector('[data-search-sort]')).toBeNull();
    expect(body.querySelector('ul')).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe('SearchPage: single store states', () => {
  it('shows the cards and an honest count of the products on this page', () => {
    const body = render(single());

    expect(body.querySelectorAll('a[href^="/amazon-"]')).toHaveLength(2);
    expect(body.querySelector('[data-search-count]')?.textContent).toBe(
      '2 productos en esta página',
    );
  });

  it('empty: the no-results message, no count, no sort and no pagination', () => {
    const loader = vi.fn(noSorts);
    const body = render(single({ result: result({ items: [] }) }), loader);

    expect(body.querySelector('[data-search-state="empty"]')?.textContent).toBe(
      'No encontramos resultados para «taladro».',
    );
    expect(body.querySelector('[data-search-count]')).toBeNull();
    expect(body.querySelector('[data-search-sort]')).toBeNull();
    expect(body.querySelector('nav[aria-label="Paginación"]')).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it('error: a retry link to the same url and no sort call', () => {
    const loader = vi.fn(noSorts);
    const body = render(single({ result: null, failure: 'timeout' }), loader);

    const alert = body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No pudimos cargar los resultados.');
    expect(alert?.querySelector('a')?.getAttribute('href')).toBe(RETRY);
    expect(alert?.querySelector('a')?.textContent).toBe('Reintentar');
    expect(loader).not.toHaveBeenCalled();
  });

  it('fallback store: the legacy notice with the store that answered', () => {
    const body = render(
      single({ store: 'target', servedByFallback: true, result: result({ vendor: 'amazon' }) }),
    );

    const notice = body.querySelector('[data-search-fallback]');
    expect(notice?.textContent).toBe(
      'Target se encuentra en mantenimiento. Sin embargo encontramos (2) resultados para “taladro” en Amazon.',
    );
  });

  it('fallback store: pagination, filter and sort links use the store that answered', async () => {
    const fallback = result({
      vendor: 'amazon',
      pagination: {
        current: 1,
        totalPages: null,
        next: '/amazon-next',
        prev: null,
        links: [{ title: '2', link: '/amazon-next' }],
      },
      refinements: [
        {
          title: 'Marcas',
          type: 'checkbox',
          options: [{ title: 'DEWALT', link: '/amazon-dewalt', checked: false }],
        },
      ],
    });
    const loader = vi.fn(() => Promise.resolve(SORTS));
    const body = await renderAll(
      single({ store: 'target', servedByFallback: true, result: fallback }, { store: 'target' }),
      loader,
    );

    const stores = [...body.querySelectorAll('a[href^="/search.html"]')]
      .map((a) => params(a.getAttribute('href')))
      .filter((link) => link.storeParams !== undefined)
      .map((link) => link.store);
    expect(stores.length).toBeGreaterThan(0);
    expect(new Set(stores)).toEqual(new Set(['amazon']));
    expect(loader).toHaveBeenCalledWith(expect.objectContaining({ store: 'amazon' }));
  });

  it('fallback to a vendor that is not a search store: products only, no CHAPI links', async () => {
    const fallback = result({
      vendor: 'walmart',
      pagination: {
        current: 1,
        totalPages: null,
        next: '/walmart-next',
        prev: null,
        links: [{ title: '2', link: '/walmart-next' }],
      },
      refinements: [
        {
          title: 'Marcas',
          type: 'checkbox',
          options: [{ title: 'DEWALT', link: '/walmart-dewalt', checked: false }],
        },
      ],
    });
    const loader = vi.fn(() => Promise.resolve(SORTS));
    const body = await renderAll(
      single({ store: 'target', servedByFallback: true, result: fallback }, { store: 'target' }),
      loader,
    );

    expect(body.querySelectorAll('a[href^="/amazon-"]')).toHaveLength(2);
    const withStoreParams = [...body.querySelectorAll('a[href^="/search.html"]')].filter(
      (a) => params(a.getAttribute('href')).storeParams !== undefined,
    );
    expect(withStoreParams).toHaveLength(0);
    expect(loader).not.toHaveBeenCalled();
  });

  it('no notice when the requested store answered', () => {
    expect(render(single()).querySelector('[data-search-fallback]')).toBeNull();
  });
});

describe('SearchPage: sort selector', () => {
  it('streams: a placeholder first, never blocking the results', () => {
    const body = render(single(), () => new Promise(() => {}));

    expect(body.querySelector('[data-search-sort="placeholder"]')).not.toBeNull();
    expect(body.querySelectorAll('a[href^="/amazon-"]')).toHaveLength(2);
  });

  it('drops the legacy Magento "price" and "position" sort links', async () => {
    const loader = vi.fn<SortOptionsLoader>(() =>
      Promise.resolve([
        ...SORTS,
        { title: 'Precio', link: 'price', selected: false },
        { title: 'Posición', link: 'position', selected: false },
      ]),
    );
    const body = await renderAll(single(), loader);

    expect(links(body, '[data-search-sort="options"]').map((link) => link.text)).toEqual([
      'Destacados',
      'Precio: Del más bajo al más alto',
    ]);
  });

  it('asks the loader with the listing and renders every option as a link, selected marked', async () => {
    const loader = vi.fn<SortOptionsLoader>(() => Promise.resolve(SORTS));
    const body = await renderAll(
      single({ filters: '/s?rh=x' }, { storeParams: '/s?rh=x' }),
      loader,
    );

    expect(loader).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ store: 'amazon', filters: '/s?rh=x', pageSize: 16 }),
    );
    const sort = body.querySelector('[data-search-sort="options"]');
    expect(sort?.querySelector('summary')?.textContent).toBe('Ordenar por: Destacados');
    // Legacy order: alphabetical.
    expect(links(body, '[data-search-sort="options"]')).toEqual([
      {
        text: 'Destacados',
        query: 'taladro',
        store: 'amazon',
        page: '1',
        storeParams: '/s?s=relevance',
      },
      {
        text: 'Precio: Del más bajo al más alto',
        query: 'taladro',
        store: 'amazon',
        page: '1',
        storeParams: '/s?s=price-asc',
      },
    ]);
    expect(sort?.querySelector('a[aria-current="true"]')?.textContent).toBe('Destacados');
  });

  it('renders nothing when there are no options or the loader rejects', async () => {
    expect((await renderAll(single(), noSorts)).querySelector('[data-search-sort]')).toBeNull();
    expect(
      (await renderAll(single(), () => Promise.reject(new Error('boom')))).querySelector(
        '[data-search-sort]',
      ),
    ).toBeNull();
  });
});

describe('SearchPage: refinements', () => {
  const refinements = [
    {
      title: 'Marcas',
      type: 'checkbox',
      options: [
        { title: 'DEWALT', link: '/s?remove-dewalt', checked: true },
        { title: 'Milwaukee', link: '/s?add-milwaukee', checked: false },
      ],
    },
  ];

  it('links every option with page 1; a checked option is selected and its link removes it', () => {
    const body = render(single({ result: result({ refinements }) }));

    const desktop = body.querySelector('aside[aria-label="Filtros de productos"]');
    expect(desktop?.querySelector('h3')?.textContent).toBe('Marcas');
    const options = [...(desktop?.querySelectorAll('li a') ?? [])];
    expect(
      options.map((a) => ({
        text: a.textContent,
        label: a.getAttribute('aria-label'),
        current: a.getAttribute('aria-current'),
        ...params(a.getAttribute('href')),
      })),
    ).toEqual([
      {
        text: 'DEWALT',
        label: 'Eliminar filtro "DEWALT".',
        current: 'true',
        query: 'taladro',
        store: 'amazon',
        page: '1',
        storeParams: '/s?remove-dewalt',
      },
      {
        text: 'Milwaukee',
        label: null,
        current: null,
        query: 'taladro',
        store: 'amazon',
        page: '1',
        storeParams: '/s?add-milwaukee',
      },
    ]);
    const clear = [...body.querySelectorAll('a')].filter(
      (a) => a.textContent === 'Limpiar filtros',
    );
    expect(clear.length).toBeGreaterThan(0);
    expect(params(clear[0]?.getAttribute('href') ?? null)).toEqual({
      query: 'taladro',
      store: 'amazon',
      page: '1',
    });
  });

  it('has a collapsible copy for small screens that works without JavaScript', () => {
    const body = render(single({ result: result({ refinements }) }));

    const details = body.querySelector('details[data-search-filters="mobile"]');
    expect(details?.querySelector('summary')?.textContent).toBe('Filtrar');
    expect(details?.querySelectorAll('li a')).toHaveLength(2);
  });

  it('no "Limpiar filtros" without a checked option, and no filters without refinements', () => {
    const unchecked = [{ ...refinements[0]!, options: [refinements[0]!.options[1]!] }];
    const body = render(single({ result: result({ refinements: unchecked }) }));
    expect(body.textContent).not.toContain('Limpiar filtros');

    expect(render(single()).querySelector('[data-search-filters]')).toBeNull();
  });
});

describe('SearchPage: long refinement groups', () => {
  const brands = (checked: number | null) => [
    {
      title: 'Marcas',
      type: 'checkbox',
      options: Array.from({ length: 7 }, (_, index) => ({
        title: `Marca ${index + 1}`,
        link: `/s?brand=${index + 1}`,
        checked: index === checked,
      })),
    },
  ];

  it('shows 5 options, the rest behind "Mostrar más" (closed)', () => {
    const body = render(single({ result: result({ refinements: brands(null) }) }));

    const aside = body.querySelector('aside[aria-label="Filtros de productos"]');
    const more = aside?.querySelector('details');
    expect(aside?.querySelectorAll(':scope li a')).toHaveLength(7);
    expect(more?.querySelectorAll('li a')).toHaveLength(2);
    expect(more?.querySelector('summary')?.textContent).toContain('Mostrar más');
    expect(more?.hasAttribute('open')).toBe(false);
  });

  it('opens "Mostrar más" when a hidden option is checked', () => {
    const body = render(single({ result: result({ refinements: brands(6) }) }));

    const more = body.querySelector('aside[aria-label="Filtros de productos"] details');
    expect(more?.hasAttribute('open')).toBe(true);
  });
});

describe('SearchPage: pagination', () => {
  it('prev, the CHAPI page links, the current page (display only) and next', () => {
    const body = render(
      single(
        {
          result: result({
            pagination: {
              current: 2,
              totalPages: null,
              prev: '/s?p1',
              next: '/s?p3',
              links: [
                { title: '1', link: '/s?p1' },
                { title: '3', link: '/s?p3' },
              ],
            },
          }),
        },
        { page: 2 },
      ),
    );

    const nav = body.querySelector('nav[aria-label="Paginación"]');
    const entries = [...(nav?.querySelectorAll('li > *') ?? [])].map((node) => ({
      text: node.textContent,
      tag: node.tagName,
      current: node.getAttribute('aria-current'),
      ...params(node.getAttribute('href')),
    }));
    const page = (text: string, link: string) => ({
      text,
      tag: 'A',
      current: null,
      query: 'taladro',
      store: 'amazon',
      page: text === 'Anterior' ? '1' : text === 'Siguiente' ? '3' : text,
      storeParams: link,
    });
    expect(entries).toEqual([
      page('Anterior', '/s?p1'),
      page('1', '/s?p1'),
      { text: '2', tag: 'SPAN', current: 'page' },
      page('3', '/s?p3'),
      page('Siguiente', '/s?p3'),
    ]);
  });

  it('no pagination when CHAPI gives no other page', () => {
    expect(render(single()).querySelector('nav[aria-label="Paginación"]')).toBeNull();
  });
});

describe('SearchPage: ChupaChoice', () => {
  const multi = (listings: StoreListing[]) =>
    view({ kind: 'multi', listings }, { store: 'chupachoice' });

  it('one titled section per store with "Ver más en {Tienda}" to that store search', () => {
    const loader = vi.fn(noSorts);
    const body = render(
      multi([
        listing({ store: 'amazon', pageSize: 12 }),
        listing({ store: 'ebay', pageSize: 6, result: result({ items: [] }) }),
        listing({ store: 'target', pageSize: 6, result: null, failure: 'error' }),
        listing({ store: 'acme', pageSize: 6 }),
      ]),
      loader,
    );

    expect(body.querySelector('h1')?.textContent).toBe('Resultados por tienda: “taladro”');
    const sections = [...body.querySelectorAll('section[data-search-section]')];
    expect(sections.map((section) => section.querySelector('h2')?.textContent)).toEqual([
      'Amazon',
      'eBay',
      'Target',
      'Acme',
    ]);
    const more = [...body.querySelectorAll('a')].filter((a) =>
      a.textContent?.startsWith('Ver más en'),
    );
    expect(more.map((a) => ({ text: a.textContent, ...params(a.getAttribute('href')) }))).toEqual([
      { text: 'Ver más en Amazon', query: 'taladro', store: 'amazon', page: '1' },
      { text: 'Ver más en Acme', query: 'taladro', store: 'acme', page: '1' },
    ]);
    expect(sections[1]?.textContent).toContain('Esta tienda no tiene ninguna coincidencia');
    expect(sections[2]?.querySelector('[role="alert"] a')?.getAttribute('href')).toBe(RETRY);
    // No store tabs, sort, filters or pagination in this view.
    expect(body.querySelector('nav[aria-label="Tiendas"]')).toBeNull();
    expect(body.querySelector('[data-search-sort]')).toBeNull();
    expect(body.querySelector('nav[aria-label="Paginación"]')).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
});
