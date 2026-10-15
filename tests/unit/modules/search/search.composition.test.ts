import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSearchSortOptions,
  searchStore,
} from '@/modules/search/infrastructure/search.composition';
import { resetServerEnvForTests } from '@/shared/config/env';
import storeConfig from '../../../fixtures/magento/store-config.json';
import ebay from '../../../fixtures/chapi/search.ebay-taladro.json';
import sortBy from '../../../fixtures/chapi/search-sort-by.amazon-taladro.json';
import { setupMswServer } from '../../../support/msw';

/** The real composition (store config, CHAPI gateway) against mocked backends. */

const MAGENTO = 'https://magento.test/graphql';
const CHAPI = 'https://chapi.test';
const server = setupMswServer();
let searchBodies: unknown[];

beforeEach(() => {
  vi.stubEnv('MAGENTO_GRAPHQL_URL', MAGENTO);
  vi.stubEnv('PUBLIC_BASE_URL', 'https://chupaprecios.com.mx');
  vi.stubEnv('CHAPI_BASE_URL', CHAPI);
  resetServerEnvForTests();
  searchBodies = [];
  server.use(
    http.post(MAGENTO, () => HttpResponse.json(storeConfig)),
    http.post(`${CHAPI}/api/v1/search/`, async ({ request }) => {
      searchBodies.push(await request.json());
      return HttpResponse.json(ebay);
    }),
    http.post(`${CHAPI}/api/v1/search/sort_by`, () => HttpResponse.json(sortBy)),
  );
});

describe('search composition', () => {
  it('routes the store through the staging store config and maps the response', async () => {
    const outcome = await searchStore('ebay', 'taladro', '', 16);

    expect(searchBodies).toEqual([
      { filters: '', query: 'taladro', store: 'ebay', engine_id: 'api', page_size: 16 },
    ]);
    expect(outcome).toMatchObject({
      status: 'ok',
      requestedStore: 'ebay',
      servedByFallback: false,
    });
  });

  it('loads sort options from sort_by when the response has none', async () => {
    const outcome = await searchStore('ebay', 'taladro', '', 16);
    if (outcome.status !== 'ok') throw new Error(outcome.status);

    const sorts = await getSearchSortOptions('ebay', 'taladro', '', 16, outcome.result);

    expect(sorts).toHaveLength(sortBy.data.length);
  });

  it('getSearchSortOptions resolves to no options when the store config read fails', async () => {
    const outcome = await searchStore('ebay', 'taladro', '', 16);
    if (outcome.status !== 'ok') throw new Error(outcome.status);
    server.use(http.post(MAGENTO, () => HttpResponse.json({}, { status: 503 })));

    await expect(getSearchSortOptions('ebay', 'taladro', '', 16, outcome.result)).resolves.toEqual(
      [],
    );
  });
});
