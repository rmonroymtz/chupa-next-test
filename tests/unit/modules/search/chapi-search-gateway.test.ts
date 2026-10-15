import { gzipSync } from 'node:zlib';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createChapiSearchGateway } from '@/modules/search/infrastructure/chapi-search-gateway';
import amazon from '../../../fixtures/chapi/search.amazon-taladro.json';
import sortBy from '../../../fixtures/chapi/search-sort-by.amazon-taladro.json';
import { DEFAULT_PRODUCT_VENDORS } from '@/shared/config/env';
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

/**
 * `fetch` resolving a 200 whose body stream breaks mid-way, like a connection
 * reset after the headers. Injected directly (not through MSW) so the failure
 * surfaces while the gateway reads the body, not inside `fetch`.
 */
const brokenBodyFetch: typeof fetch = async () => {
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode('{"vendor":"amazon","data":{'));
      controller.error(new TypeError('terminated'));
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/json' } });
};

function setup(timeoutMs = 200, fetchImpl?: typeof fetch) {
  const observability = createCapturingObservability();
  const gateway = createChapiSearchGateway({
    baseUrl: BASE,
    timeoutMs,
    logger: observability.logger,
    metrics: observability.metrics,
    vendors: DEFAULT_PRODUCT_VENDORS,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
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

  it('does not count repeated skus as skipped items', async () => {
    const [first] = amazon.data.products;
    server.use(
      http.post(SEARCH, () =>
        HttpResponse.json({ ...amazon, data: { ...amazon.data, products: [first, first] } }),
      ),
    );
    const { gateway, metricsNamed, logsAt } = setup();

    const result = await gateway.search(QUERY);

    expect(result).toMatchObject({ status: 'ok', data: { skippedItems: 0, duplicateItems: 1 } });
    expect(metricsNamed('ChapiSearchSkippedItems')).toEqual([]);
    expect(logsAt('warn')).toEqual([]);
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

  it('returns error, not invalid, when a 2xx body stream fails', async () => {
    const { gateway, metricsNamed } = setup(200, brokenBodyFetch);

    await expect(gateway.search(QUERY)).resolves.toEqual({ status: 'error' });
    expect(metricsNamed('ChapiError')[0]?.dimensions.Reason).toBe('http');
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

  it('returns error when a 2xx body stream fails and invalid for bad JSON', async () => {
    const sortQuery = {
      query: 'q',
      store: 'amazon',
      engineId: 'direct',
      filters: '',
      maxResults: 16,
    };
    await expect(setup(200, brokenBodyFetch).gateway.sortOptions(sortQuery)).resolves.toEqual({
      status: 'error',
    });

    server.use(http.post(SORT, () => new HttpResponse('{"data": [', { status: 200 })));
    await expect(setup().gateway.sortOptions(sortQuery)).resolves.toEqual({ status: 'invalid' });
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
