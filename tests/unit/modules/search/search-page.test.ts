import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { StoreSearchOutcome } from '@/modules/search/application/store-search';
import { resolveSearchPage, type SearchPageDeps } from '@/modules/search/application/search-page';
import type { SearchResult } from '@/modules/search/domain/search-result';

const USER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36';
const BOT = 'Googlebot/2.1';

const result = (vendor: string): SearchResult => ({
  vendor,
  items: [],
  totalCount: 0,
  pagination: { current: 1, totalPages: null, next: null, prev: null, links: [] },
  refinements: [],
  sorts: [],
  skippedItems: 0,
  duplicateItems: 0,
});

const ok = (store: string, vendor = store): StoreSearchOutcome => ({
  status: 'ok',
  requestedStore: store,
  result: result(vendor),
  servedByFallback: vendor !== store,
});

function setup(overrides: Partial<SearchPageDeps> = {}) {
  const deps = {
    isBot: vi.fn((userAgent: string | null) => userAgent === BOT || !userAgent),
    searchStore: vi.fn(async (store: string): Promise<StoreSearchOutcome> => ok(store)),
    gridPerPage: vi.fn(async () => 16),
    logger: pino({ level: 'silent' }),
    metrics: { emitMetric: vi.fn(), timed: vi.fn() },
    ...overrides,
  } satisfies SearchPageDeps;
  const resolve = (search: string, userAgent: string | null = USER) =>
    resolveSearchPage({ search, userAgent }, deps);
  return { deps, resolve };
}

describe('resolveSearchPage: request parsing', () => {
  it('searches one CHAPI store with the store config page size and storeParams as filters', async () => {
    const { deps, resolve } = setup();

    const decision = await resolve(
      'query=%20taladro%20&store=amazon&page=2&storeParams=%2Fs%3Fk%3Dx',
    );

    expect(deps.searchStore).toHaveBeenCalledExactlyOnceWith('amazon', 'taladro', '/s?k=x', 16);
    expect(decision).toEqual({
      kind: 'page',
      query: 'taladro',
      store: 'amazon',
      page: 2,
      storeParams: '/s?k=x',
      results: {
        kind: 'single',
        listing: {
          store: 'amazon',
          pageSize: 16,
          filters: '/s?k=x',
          result: result('amazon'),
          failure: null,
          servedByFallback: false,
        },
      },
    });
  });

  it('defaults a missing or blank store to chupachoice without redirecting', async () => {
    const { resolve } = setup();

    await expect(resolve('query=taladro')).resolves.toMatchObject({
      kind: 'page',
      store: 'chupachoice',
    });
    await expect(resolve('query=taladro&store=')).resolves.toMatchObject({
      kind: 'page',
      store: 'chupachoice',
    });
  });

  it('accepts a known store in any letter case', async () => {
    const { deps, resolve } = setup();

    await expect(resolve('query=taladro&store=EBay')).resolves.toMatchObject({ store: 'ebay' });
    expect(deps.searchStore).toHaveBeenCalledWith('ebay', 'taladro', '', 16);
  });

  it.each(['homedepot', 'walmart', 'nope'])(
    'redirects store=%s to chupachoice keeping other params and dropping storeParams',
    async (store) => {
      const { deps, resolve } = setup();

      const decision = await resolve(`query=taladro&store=${store}&page=3&storeParams=%2Fs&utm=x`);

      expect(decision).toEqual({
        kind: 'redirect',
        reason: 'unknown_store',
        location: '/search.html?query=taladro&store=chupachoice&page=3&utm=x',
      });
      expect(deps.searchStore).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '-1', '1.5', 'abc', ''])('ignores page=%s', async (page) => {
    const { resolve } = setup();

    await expect(resolve(`query=taladro&store=amazon&page=${page}`)).resolves.toMatchObject({
      page: null,
    });
  });

  it('an empty or missing query is a page without results and without backend calls', async () => {
    const { deps, resolve } = setup();

    for (const search of ['', 'query=', 'query=%20%20&store=amazon']) {
      await expect(resolve(search)).resolves.toMatchObject({
        kind: 'page',
        query: '',
        results: { kind: 'none', reason: 'empty_query' },
      });
    }
    expect(deps.searchStore).not.toHaveBeenCalled();
  });
});

describe('resolveSearchPage: bots', () => {
  it.each([BOT, null])(
    'user agent %s gets a page without results and no backend call',
    async (ua) => {
      const { deps, resolve } = setup();

      const decision = await resolve('query=taladro&store=amazon', ua);

      expect(decision).toMatchObject({
        kind: 'page',
        query: 'taladro',
        store: 'amazon',
        results: { kind: 'none', reason: 'bot' },
      });
      expect(deps.searchStore).not.toHaveBeenCalled();
    },
  );
});

describe('resolveSearchPage: CHAPI outcomes', () => {
  it.each(['timeout', 'error', 'invalid'] as const)(
    'a CHAPI %s is a failure state',
    async (status) => {
      const { resolve } = setup({
        searchStore: vi.fn(async (store: string) => ({ status, requestedStore: store })),
      });

      await expect(resolve('query=taladro&store=amazon')).resolves.toMatchObject({
        results: { kind: 'single', listing: { result: null, failure: status } },
      });
    },
  );

  it('an unsupported store (no CHAPI routing) is an error state', async () => {
    const { resolve } = setup({
      searchStore: vi.fn(async (store: string) => ({
        status: 'unsupported_store' as const,
        requestedStore: store,
      })),
    });

    await expect(resolve('query=taladro&store=acme')).resolves.toMatchObject({
      results: { kind: 'single', listing: { result: null, failure: 'error' } },
    });
  });

  it('turns an unexpected rejection into an error state instead of failing the page', async () => {
    const { resolve } = setup({
      searchStore: vi.fn(async (store: string) => {
        if (store === 'ebay') throw new Error('boom');
        return ok(store);
      }),
    });

    await expect(resolve('query=taladro&store=ebay')).resolves.toMatchObject({
      results: { kind: 'single', listing: { result: null, failure: 'error' } },
    });
    const multi = await resolve('query=taladro');
    expect(multi).toMatchObject({ results: { kind: 'multi' } });
    if (multi.kind !== 'page' || multi.results.kind !== 'multi') throw new Error('expected multi');
    expect(multi.results.listings.map((listing) => listing.failure)).toEqual([
      null,
      'error',
      null,
      null,
    ]);
  });

  it('flags a result served by a fallback store', async () => {
    const { resolve } = setup({ searchStore: vi.fn(async () => ok('target', 'amazon')) });

    await expect(resolve('query=taladro&store=target')).resolves.toMatchObject({
      results: { kind: 'single', listing: { servedByFallback: true } },
    });
  });

  it('falls back to the default page size when the store config fails', async () => {
    const { deps, resolve } = setup({
      gridPerPage: vi.fn(() => Promise.reject(new Error('magento down'))),
    });

    await resolve('query=taladro&store=amazon');

    expect(deps.searchStore).toHaveBeenCalledWith('amazon', 'taladro', '', 12);
  });
});

describe('resolveSearchPage: ChupaChoice', () => {
  it('searches the four legacy lists in parallel, each one independent', async () => {
    const { deps, resolve } = setup({
      searchStore: vi.fn(async (store: string) =>
        store === 'target' ? ({ status: 'timeout', requestedStore: store } as const) : ok(store),
      ),
    });

    const decision = await resolve('query=taladro&storeParams=%2Fs');

    expect(vi.mocked(deps.searchStore).mock.calls).toEqual([
      ['amazon', 'taladro', '', 12],
      ['ebay', 'taladro', '', 6],
      ['target', 'taladro', '', 6],
      ['acme', 'taladro', '', 6],
    ]);
    expect(deps.gridPerPage).not.toHaveBeenCalled();
    expect(decision).toMatchObject({
      kind: 'page',
      store: 'chupachoice',
      results: {
        kind: 'multi',
        listings: [
          { store: 'amazon', pageSize: 12, failure: null },
          { store: 'ebay', pageSize: 6, failure: null },
          { store: 'target', pageSize: 6, result: null, failure: 'timeout' },
          { store: 'acme', pageSize: 6, failure: null },
        ],
      },
    });
  });

  it('starts the four searches together, not one after another', async () => {
    let started = 0;
    const gates: (() => void)[] = [];
    const { resolve } = setup({
      searchStore: vi.fn((store: string) => {
        started += 1;
        return new Promise<StoreSearchOutcome>((done) => gates.push(() => done(ok(store))));
      }),
    });

    const pending = resolve('query=taladro');
    await vi.waitFor(() => expect(started).toBe(4));
    gates.forEach((open) => open());

    await expect(pending).resolves.toMatchObject({ results: { kind: 'multi' } });
  });
});

describe('resolveSearchPage: SearchPage metric', () => {
  const outcomeOf = (deps: SearchPageDeps) =>
    vi.mocked(deps.metrics.emitMetric).mock.calls.map(([metric]) => metric);

  it.each([
    ['redirect_unknown_store', 'query=taladro&store=walmart', USER, ok],
    ['empty_query', 'query=&store=amazon', USER, ok],
    ['bot', 'query=taladro&store=amazon', BOT, ok],
    ['results', 'query=taladro&store=amazon', USER, ok],
    [
      'failure',
      'query=taladro&store=amazon',
      USER,
      (store: string): StoreSearchOutcome => ({ status: 'timeout', requestedStore: store }),
    ],
  ] as const)('emits Outcome=%s once', async (outcome, search, ua, answer) => {
    const { deps, resolve } = setup({ searchStore: vi.fn(async (store: string) => answer(store)) });

    await resolve(search, ua);

    expect(outcomeOf(deps)).toEqual([
      { name: 'SearchPage', value: 1, dimensions: { Outcome: outcome } },
    ]);
  });

  it('counts a ChupaChoice view with one failed list as a failure', async () => {
    const { deps, resolve } = setup({
      searchStore: vi.fn(async (store: string) =>
        store === 'acme' ? ({ status: 'error', requestedStore: store } as const) : ok(store),
      ),
    });

    await resolve('query=taladro');

    expect(outcomeOf(deps)).toEqual([
      { name: 'SearchPage', value: 1, dimensions: { Outcome: 'failure' } },
    ]);
  });
});
