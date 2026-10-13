import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoProductRepository } from '@/modules/product/infrastructure/magento-product-repository';
import { createMagentoClient } from '@/shared/graphql/client';
import fixture from '../../../../fixtures/magento/product-by-route.simple.json';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const URL = 'https://magento.test/graphql';
const ROUTE = fixture.data.route.relative_url;
const server = setupMswServer();

const repository = () =>
  createMagentoProductRepository(
    createMagentoClient({
      url: URL,
      timeoutMs: 200,
      storeCode: 'default',
      currency: 'MXN',
      ...createCapturingObservability(),
    }),
  );

describe('MagentoProductRepository', () => {
  it('reads the product through route() with the route url as variable', async () => {
    let body: { operationName?: string; variables?: unknown } = {};
    server.use(
      http.post(URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json(fixture);
      }),
    );

    const result = await repository().findByRouteUrl(ROUTE);

    expect(body).toMatchObject({ operationName: 'ProductByRoute', variables: { url: ROUTE } });
    expect(result).toMatchObject({
      kind: 'product',
      product: { sku: '126981644035|428130345038', price: { final: { currency: 'MXN' } } },
    });
  });

  it('resolves not_found for a null route', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ data: { route: null } })));

    await expect(repository().findByRouteUrl('missing.html')).resolves.toEqual({
      kind: 'not_found',
    });
  });

  it('rejects when Magento fails instead of resolving not_found', async () => {
    server.use(http.post(URL, () => new HttpResponse(null, { status: 503 })));

    await expect(repository().findByRouteUrl(ROUTE)).rejects.toMatchObject({
      kind: 'http',
      status: 503,
    });
  });
});
