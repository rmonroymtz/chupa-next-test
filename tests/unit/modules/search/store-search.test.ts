import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { SearchGateway } from '@/modules/search/application/ports';
import { createStoreSearch } from '@/modules/search/application/store-search';
import type { SearchResult } from '@/modules/search/domain/search-result';
import type { EngineRouting, StoreConfig } from '@/modules/store-config/domain/store-config';

const routing: EngineRouting = {
  engineSettings: {},
  searchEngineSettings: { amazon: 'direct', ebay: 'api', walmart: '' },
  serviceFallback: { amazon: 'amazon', ebay: 'ebay', homedepot: 'amazon', walmart: 'walmart' },
};

const result: SearchResult = {
  vendor: 'amazon',
  items: [],
  totalCount: 0,
  pagination: { current: 1, totalPages: null, next: null, prev: null, links: [] },
  refinements: [],
  sorts: [],
  skippedItems: 0,
  duplicateItems: 0,
};

const SORTS = [{ title: 'Destacados', link: '/s?k=drill', selected: true }];

function setup(overrides: Partial<SearchGateway> = {}, config?: () => Promise<StoreConfig>) {
  const gateway: SearchGateway = {
    search: vi.fn(async () => ({ status: 'ok' as const, data: result })),
    sortOptions: vi.fn(async () => ({ status: 'ok' as const, data: SORTS })),
    ...overrides,
  };
  const get = config ?? (async () => ({ engineRouting: routing }) as StoreConfig);
  const search = createStoreSearch({
    gateway,
    storeConfig: { get },
    logger: pino({ level: 'silent' }),
  });
  return { gateway, search };
}

const INPUT = { store: 'amazon', query: 'taladro', filters: '', pageSize: 16 };

describe('StoreSearch.search', () => {
  it('sends the service fallback store and its search engine to CHAPI', async () => {
    const { gateway, search } = setup();

    const outcome = await search.search({ ...INPUT, store: 'HomeDepot', filters: '/s?k=x' });

    expect(gateway.search).toHaveBeenCalledWith({
      query: 'taladro',
      store: 'amazon',
      engineId: 'direct',
      filters: '/s?k=x',
      pageSize: 16,
    });
    expect(outcome).toEqual({
      status: 'ok',
      requestedStore: 'homedepot',
      result,
      servedByFallback: true,
    });
  });

  it('is not a fallback when the responding vendor is the requested store', async () => {
    const { search } = setup();

    await expect(search.search(INPUT)).resolves.toMatchObject({
      status: 'ok',
      servedByFallback: false,
    });
  });

  it.each(['chupachoice', 'walmart', 'unknown'])(
    'reports %s as unsupported without calling CHAPI',
    async (store) => {
      const { gateway, search } = setup();

      await expect(search.search({ ...INPUT, store })).resolves.toEqual({
        status: 'unsupported_store',
        requestedStore: store,
      });
      expect(gateway.search).not.toHaveBeenCalled();
    },
  );

  it.each(['timeout', 'error', 'invalid'] as const)('passes a CHAPI %s through', async (status) => {
    const { search } = setup({ search: async () => ({ status }) });

    await expect(search.search(INPUT)).resolves.toEqual({ status, requestedStore: 'amazon' });
  });

  it('returns error without calling CHAPI when the store config fails', async () => {
    const { gateway, search } = setup({}, () => Promise.reject(new Error('magento down')));

    await expect(search.search(INPUT)).resolves.toEqual({
      status: 'error',
      requestedStore: 'amazon',
    });
    expect(gateway.search).not.toHaveBeenCalled();
  });
});

describe('StoreSearch.sortOptions', () => {
  it('returns the sorts of the search response without calling sort_by', async () => {
    const { gateway, search } = setup();
    const sorts = [{ title: 'Precio', link: '/s?s=price', selected: false }];

    await expect(search.sortOptions(INPUT, { ...result, sorts })).resolves.toEqual(sorts);
    expect(gateway.sortOptions).not.toHaveBeenCalled();
  });

  it('calls sort_by with the legacy body when the response has no sorts', async () => {
    const { gateway, search } = setup();

    await expect(
      search.sortOptions({ ...INPUT, store: 'ebay', filters: '/s?k=drill&page=2' }, result),
    ).resolves.toEqual(SORTS);
    expect(gateway.sortOptions).toHaveBeenCalledWith({
      query: 'taladro',
      store: 'ebay',
      engineId: 'api',
      filters: '/s?k=drill&page=2',
      maxResults: 16,
    });
  });

  it('never rejects and returns no sort options when the store config read fails', async () => {
    const { gateway, search } = setup({}, () => Promise.reject(new Error('magento down')));

    await expect(search.sortOptions(INPUT, result)).resolves.toEqual([]);
    expect(gateway.sortOptions).not.toHaveBeenCalled();
  });

  it('degrades to no sort options when sort_by fails or the store is unsupported', async () => {
    const failing = setup({ sortOptions: async () => ({ status: 'timeout' }) });
    await expect(failing.search.sortOptions(INPUT, result)).resolves.toEqual([]);

    const unsupported = setup();
    await expect(
      unsupported.search.sortOptions({ ...INPUT, store: 'chupachoice' }, result),
    ).resolves.toEqual([]);
    expect(unsupported.gateway.sortOptions).not.toHaveBeenCalled();
  });
});
