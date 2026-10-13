import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import storeConfig from '../fixtures/magento/store-config.json';
import { startMockBackends, type MockBackends } from './support/mock-backends';
import { startNext, type RunningNext } from './support/next-server';

// Own server and mocks: no page request ran before, so no deferred work
// (such as a copy mutation from `after()`) can reach the mocks.
let backends: MockBackends;
let next: RunningNext;

beforeAll(async () => {
  backends = await startMockBackends({
    routes: {},
    storeConfig: storeConfig.data.storeConfig,
    chapi: {},
    chapiDefaultDelayMs: 0,
  });
  next = await startNext({
    MAGENTO_GRAPHQL_URL: backends.magentoUrl,
    CHAPI_BASE_URL: backends.chapiUrl,
    PUBLIC_BASE_URL: 'https://chupaprecios.com.mx',
    LOG_LEVEL: 'error',
  });
});

afterAll(async () => {
  await next?.stop();
  await backends?.close();
});

describe('GET /healthz on the standalone server', () => {
  it('answers 200 ok, uncacheable, without touching Magento or the scraper API', async () => {
    const response = await fetch(`${next.baseUrl}/healthz`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(backends.calls).toEqual([]);
  });
});
