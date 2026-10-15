import { gzipSync } from 'node:zlib';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createChapiSearchGateway } from '@/modules/search/infrastructure/chapi-search-gateway';
import amazon from '../../../fixtures/chapi/search.amazon-taladro.json';
import sortBy from '../../../fixtures/chapi/search-sort-by.amazon-taladro.json';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const BASE = 'https://chapi.test';
const SEARCH = `${BASE}/api/v1/search/`;
const SORT = `${BASE}/api/v1/search/sort_by`;
const QUERY = {
  query: 'taladro',
  store: 'amazon',
  engineId: 'direct',
  filters: '',
  pageSize: 16,
};
const server = setupMswServer();

function setup(timeoutMs = 200) {
  const observability = createCapturingObservability();
  const gateway = createChapiSearchGateway({
    baseUrl: BASE,
    timeoutMs,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway, ...observability };
}

describe('ChapiSearchGateway.search', () => {
  it('posts the legacy body as JSON and returns the mapped result', async () => {
    let body: unknown;
    let headers: Headers | undefined;
    server.use(
      http.post(SEARCH, async ({ request }) => {
        body = await request.json();
        headers = request.headers;
        return HttpResponse.json(amazon);
      }),
    );
    const { gateway, metricsNamed } = setup();

    const result = await gateway.search({ ...QUERY, filters: '/-/es/s?k=drill&page=2' });

    expect(body).toEqual({
      filters: '/-/es/s?k=drill&page=2',
      query: 'taladro',
      store: 'amazon',
      engine_id: 'direct',
      page_size: 16,
    });
    expect(headers?.get('content-type')).toBe('application/json');
    expect(headers?.get('accept')).toBe('application/json');
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.data.items).toHaveLength(4);
    expect(metricsNamed('ChapiLatency')).toEqual([
      expect.objectContaining({
        unit: 'Milliseconds',
        dimensions: { Store: 'amazon', Operation: 'search', Outcome: 'ok' },
      }),
    ]);
    expect(metricsNamed('ChapiError')).toEqual([]);
  });

  it('reads a gzip-encoded response', async () => {
    server.use(
      http.post(
        SEARCH,
        () =>
          new HttpResponse(gzipSync(JSON.stringify(amazon)), {
            headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
          }),
      ),
    );

    const result = await setup().gateway.search(QUERY);

    expect(result.status).toBe('ok');
  });

  it('counts skipped items', async () => {
    const products = [amazon.data.products[0], { ...amazon.data.products[1], asin: '' }];
    server.use(
      http.post(SEARCH, () => HttpResponse.json({ ...amazon, data: { ...amazon.data, products } })),
    );
    const { gateway, metricsNamed, logsAt } = setup();

    await gateway.search(QUERY);

    expect(metricsNamed('ChapiSearchSkippedItems')).toEqual([
      expect.objectContaining({ value: 1, dimensions: { Store: 'amazon' } }),
    ]);
    expect(logsAt('warn')[0]).toMatchObject({ store: 'amazon', skippedItems: 1 });
  });

  it('returns timeout when CHAPI is too slow and counts it', async () => {
    server.use(
      http.post(SEARCH, async () => {
        await delay(500);
        return HttpResponse.json(amazon);
      }),
    );
    const { gateway, metricsNamed } = setup(50);

    await expect(gateway.search(QUERY)).resolves.toEqual({ status: 'timeout' });
    expect(metricsNamed('ChapiError')).toEqual([
      expect.objectContaining({
        dimensions: { Store: 'amazon', Operation: 'search', Reason: 'timeout' },
      }),
    ]);
  });

  it('returns error for non-2xx responses and network failures', async () => {
    server.use(http.post(SEARCH, () => new HttpResponse('bad gateway', { status: 502 })));
    const { gateway, metricsNamed, logsAt } = setup();

    await expect(gateway.search(QUERY)).resolves.toEqual({ status: 'error' });
    expect(metricsNamed('ChapiError')[0]?.dimensions).toEqual({
      Store: 'amazon',
      Operation: 'search',
      Reason: 'http',
    });
    expect(logsAt('warn')[0]).toMatchObject({ store: 'amazon', status: 502 });

    server.use(http.post(SEARCH, () => HttpResponse.error()));
    await expect(setup().gateway.search(QUERY)).resolves.toEqual({ status: 'error' });
  });

  it('returns invalid for malformed JSON or a body without data', async () => {
    server.use(http.post(SEARCH, () => new HttpResponse('<html>', { status: 200 })));
    const { gateway, metricsNamed } = setup();
    await expect(gateway.search(QUERY)).resolves.toEqual({ status: 'invalid' });
    expect(metricsNamed('ChapiError')[0]?.dimensions.Reason).toBe('invalid_response');

    server.use(http.post(SEARCH, () => HttpResponse.json({ vendor: 'amazon', error: 'boom' })));
    await expect(setup().gateway.search(QUERY)).resolves.toEqual({ status: 'invalid' });
  });
});

describe('ChapiSearchGateway.sortOptions', () => {
  it('posts the legacy sort_by body and returns the options', async () => {
    let body: unknown;
    server.use(
      http.post(SORT, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(sortBy);
      }),
    );
    const { gateway, metricsNamed } = setup();

    const result = await gateway.sortOptions({
      query: 'taladro',
      store: 'amazon',
      engineId: 'direct',
      filters: '',
      maxResults: 16,
    });

    expect(body).toEqual({
      store: 'amazon',
      query: 'taladro',
      engine_id: 'direct',
      filters: '',
      max_results: 16,
    });
    expect(result).toMatchObject({ status: 'ok', data: { length: 6 } });
    expect(metricsNamed('ChapiLatency')[0]?.dimensions).toEqual({
      Store: 'amazon',
      Operation: 'search_sort',
      Outcome: 'ok',
    });
  });

  it('never rejects', async () => {
    server.use(http.post(SORT, () => HttpResponse.error()));

    await expect(
      setup().gateway.sortOptions({
        query: 'q',
        store: 'ebay',
        engineId: 'api',
        filters: '',
        maxResults: 16,
      }),
    ).resolves.toEqual({ status: 'error' });
  });
});
