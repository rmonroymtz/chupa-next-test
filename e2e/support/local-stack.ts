import { readFileSync } from 'node:fs';
import { startMockBackends } from '../../tests/integration/support/mock-backends';
import { buildNext, PROJECT_ROOT, startNext } from '../../tests/integration/support/next-server';
import { LOCAL_PRODUCTS } from './local-products';

const readFixture = <T>(path: string): T =>
  JSON.parse(readFileSync(`${PROJECT_ROOT}tests/fixtures/${path}`, 'utf8')) as T;

/**
 * Builds the app (skipped with `PDP_IT_SKIP_BUILD=1`), then starts mock
 * Magento/CHAPI and the standalone server. Tests read its url from
 * `E2E_LOCAL_BASE_URL`. Returns the teardown.
 */
export default async function startLocalStack(): Promise<() => Promise<void>> {
  const productRoute = readFixture<{ data: { route: Record<string, unknown> } }>(
    'magento/product-by-route.simple.json',
  );
  const storeConfig = readFixture<{ data: { storeConfig: Record<string, unknown> } }>(
    'magento/store-config.json',
  );
  const chapiFound = readFixture<Record<string, unknown>>('chapi/product.ebay.found.json');

  await buildNext();
  const backends = await startMockBackends({
    routes: {
      [LOCAL_PRODUCTS.magento.routeUrl]: {
        ...productRoute.data.route,
        relative_url: LOCAL_PRODUCTS.magento.routeUrl,
        url_key: LOCAL_PRODUCTS.magento.routeUrl.replace('.html', ''),
        sku: LOCAL_PRODUCTS.magento.sku,
      },
    },
    storeConfig: storeConfig.data.storeConfig,
    chapi: { [LOCAL_PRODUCTS.scraped.chapiKey]: { body: chapiFound } },
    chapiDefaultDelayMs: 0,
  });
  const next = await startNext({
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL: 'https://chupaprecios.com.mx',
    MAGENTO_TIMEOUT_MS: '3000',
    LOG_LEVEL: 'warn',
  });
  process.env.E2E_LOCAL_BASE_URL = next.baseUrl;

  return async () => {
    await next.stop();
    await backends.close();
  };
}
