import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoRouteResolver } from '@/modules/routing/infrastructure/magento-route-resolver';
import { createMagentoClient, MagentoRequestError } from '@/shared/graphql/client';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

function setup() {
  const client = createMagentoClient({
    url: URL,
    timeoutMs: 200,
    storeCode: 'default',
    currency: 'MXN',
    ...createCapturingObservability(),
  });
  return createMagentoRouteResolver(client);
}

describe('MagentoRouteResolver', () => {
  it('sends the route url with a literal | and maps the product route', async () => {
    let variables: unknown;
    server.use(
      http.post(URL, async ({ request }) => {
        variables = ((await request.json()) as { variables: unknown }).variables;
        return HttpResponse.json({
          data: {
            route: {
              __typename: 'SimpleProduct',
              type: 'PRODUCT',
              redirect_code: 0,
              relative_url: 'ebay-1|2-shirt.html',
              uid: 'NzY2',
            },
          },
        });
      }),
    );

    const result = await setup().resolve('ebay-1|2-shirt.html');

    expect(variables).toEqual({ url: 'ebay-1|2-shirt.html' });
    expect(result).toEqual({ kind: 'product', uid: 'NzY2', relativeUrl: 'ebay-1|2-shirt.html' });
  });

  it('resolves not_found only when Magento answers with a null route', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ data: { route: null } })));

    await expect(setup().resolve('missing.html')).resolves.toEqual({ kind: 'not_found' });
  });

  it('rejects instead of returning not_found when Magento is down', async () => {
    server.use(http.post(URL, () => new HttpResponse('Bad gateway', { status: 502 })));

    const outcome = await setup()
      .resolve('any.html')
      .then(
        (value) => ({ resolved: value }),
        (error: unknown) => ({ rejected: error }),
      );

    expect(outcome).not.toHaveProperty('resolved');
    expect((outcome as { rejected: unknown }).rejected).toBeInstanceOf(MagentoRequestError);
  });

  it('rejects on GraphQL errors instead of returning not_found', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json({ data: { route: null }, errors: [{ message: 'boom' }] }),
      ),
    );

    await expect(setup().resolve('any.html')).rejects.toMatchObject({ kind: 'graphql' });
  });
});
