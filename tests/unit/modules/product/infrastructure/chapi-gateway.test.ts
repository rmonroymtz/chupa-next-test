import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createChapiGateway } from '@/modules/product/infrastructure/chapi-gateway';
import found from '../../../../fixtures/chapi/product.ebay.found.json';
import variants from '../../../../fixtures/chapi/variants.synthetic.json';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const BASE = 'https://chapi.test';
const PRODUCT = `${BASE}/api/v1/product/`;
const VARIANTS = `${BASE}/api/v1/product/variants/`;
const QUERY = { sku: '126981644035|428130345038', store: 'ebay', engineId: 'api' };
const server = setupMswServer();

function setup(timeoutMs = 200) {
  const observability = createCapturingObservability();
  const gateway = createChapiGateway({
    baseUrl: BASE,
    timeoutMs,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway, ...observability };
}

describe('ChapiGateway.getProduct', () => {
  it('posts sku, store and engine_id and returns the found product', async () => {
    let body: unknown;
    server.use(
      http.post(PRODUCT, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(found);
      }),
    );
    const { gateway, metricsNamed } = setup();

    const result = await gateway.getProduct(QUERY);

    expect(body).toEqual({ sku: QUERY.sku, store: 'ebay', engine_id: 'api' });
    expect(result).toMatchObject({
      status: 'found',
      product: { price: { current: 1145.13, currency: 'MXN' } },
    });
    expect(metricsNamed('ChapiLatency')).toEqual([
      expect.objectContaining({
        unit: 'Milliseconds',
        dimensions: { Store: 'ebay', Operation: 'product', Outcome: 'found' },
      }),
    ]);
  });

  it('returns not_found for an empty data payload', async () => {
    server.use(
      http.post(PRODUCT, () => HttpResponse.json({ vendor: 'ebay', status: 'ok', data: [] })),
    );

    await expect(setup().gateway.getProduct(QUERY)).resolves.toEqual({ status: 'not_found' });
  });

  it('returns not_found for HTTP 404', async () => {
    server.use(
      http.post(PRODUCT, () => HttpResponse.json({ detail: 'Not found' }, { status: 404 })),
    );

    await expect(setup().gateway.getProduct(QUERY)).resolves.toEqual({ status: 'not_found' });
  });

  it('returns an http error for other non-2xx responses and counts it', async () => {
    server.use(http.post(PRODUCT, () => new HttpResponse('blocked', { status: 503 })));
    const { gateway, metricsNamed, logsAt } = setup();

    await expect(gateway.getProduct(QUERY)).resolves.toEqual({ status: 'error', reason: 'http' });
    expect(metricsNamed('ChapiError')).toEqual([
      expect.objectContaining({
        dimensions: { Store: 'ebay', Operation: 'product', Reason: 'http' },
      }),
    ]);
    expect(logsAt('warn')[0]).toMatchObject({ store: 'ebay', reason: 'http', status: 503 });
  });

  it('returns a timeout error when the API is too slow', async () => {
    server.use(
      http.post(PRODUCT, async () => {
        await delay(500);
        return HttpResponse.json(found);
      }),
    );

    await expect(setup(50).gateway.getProduct(QUERY)).resolves.toEqual({
      status: 'error',
      reason: 'timeout',
    });
  });

  it('returns invalid_response for a non-JSON or schema-invalid body', async () => {
    server.use(http.post(PRODUCT, () => new HttpResponse('<html>', { status: 200 })));
    await expect(setup().gateway.getProduct(QUERY)).resolves.toEqual({
      status: 'error',
      reason: 'invalid_response',
    });

    server.use(http.post(PRODUCT, () => HttpResponse.json({ vendor: 'ebay', data: { title: 1 } })));
    await expect(setup().gateway.getProduct(QUERY)).resolves.toEqual({
      status: 'error',
      reason: 'invalid_response',
    });
  });

  it('never rejects, even on a network failure', async () => {
    server.use(http.post(PRODUCT, () => HttpResponse.error()));

    await expect(setup().gateway.getProduct(QUERY)).resolves.toEqual({
      status: 'error',
      reason: 'http',
    });
  });
});

describe('ChapiGateway.getVariants', () => {
  it('posts to the variants endpoint and maps dimensions', async () => {
    let body: unknown;
    server.use(
      http.post(VARIANTS, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(variants);
      }),
    );

    const result = await setup().gateway.getVariants({
      sku: 'B0TEST',
      store: 'amazon',
      engineId: 'direct',
    });

    expect(body).toEqual({ sku: 'B0TEST', store: 'amazon', engine_id: 'direct' });
    expect(result).toMatchObject({ status: 'found', product: { sku: 'B0TEST' } });
  });
});
