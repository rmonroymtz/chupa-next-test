import { describe, expect, it } from 'vitest';
import { createScrapedProductLoader } from '@/modules/product/application/scraped-product-loader';
import { parseSearchProductResult } from '@/modules/product/infrastructure/chapi-mapper';
import type { ScrapedProduct } from '@/modules/product/domain/product';
import {
  FAKE_STORE_CONFIG,
  FakeScrapedProductGateway,
  FakeStoreConfigRepository,
} from '../../../../support/fakes';
import { createCapturingObservability } from '../../../../support/observability';
import found from '../../../../fixtures/chapi/product.ebay.found.json';

const parsed = parseSearchProductResult(found);
const PRODUCT = (parsed.status === 'found' ? parsed.product : null) as ScrapedProduct;
const REF = { sku: '126981644035|428130345038', vendor: 'ebay' };

function setup(
  options: {
    result?: ConstructorParameters<typeof FakeScrapedProductGateway>[0];
    storeConfigFails?: boolean;
    engineSettings?: Record<string, string>;
  } = {},
) {
  const gateway = new FakeScrapedProductGateway(
    options.result ?? { 'ebay:126981644035|428130345038': { status: 'found', product: PRODUCT } },
  );
  const storeConfig = new FakeStoreConfigRepository(
    options.engineSettings
      ? {
          ...FAKE_STORE_CONFIG,
          engineRouting: {
            ...FAKE_STORE_CONFIG.engineRouting,
            engineSettings: options.engineSettings,
          },
        }
      : FAKE_STORE_CONFIG,
    options.storeConfigFails ?? false,
  );
  const observability = createCapturingObservability();
  const loader = createScrapedProductLoader({
    gateway,
    storeConfig,
    logger: observability.logger,
    metrics: observability.metrics,
  });
  return { gateway, storeConfig, observability, loader };
}

describe('scraped product loader', () => {
  it('queries the scraper with the engine resolved from the store config', async () => {
    const { loader, gateway } = setup();

    const outcome = await loader.load(REF);

    expect(gateway.calls).toEqual([
      { sku: '126981644035|428130345038', store: 'ebay', engineId: 'api' },
    ]);
    expect(outcome).toEqual({ kind: 'found', product: PRODUCT, copyRequest: REF });
  });

  it.each([
    ['not_found', { status: 'not_found' }],
    ['error', { status: 'error', reason: 'timeout' }],
  ] as const)('reports %s from the scraper as unavailable', async (reason, result) => {
    const { loader } = setup({ result: { 'ebay:126981644035|428130345038': result } });

    expect(await loader.load(REF)).toEqual({ kind: 'unavailable', reason });
  });

  it('is unavailable without calling the scraper when the url had no usable sku', async () => {
    const { loader, gateway, storeConfig } = setup();

    expect(await loader.load(null)).toEqual({ kind: 'unavailable', reason: 'unparsable_url' });
    expect(gateway.calls).toEqual([]);
    expect(storeConfig.calls).toBe(0);
  });

  it('is unavailable when the store has no engine', async () => {
    const { loader, gateway } = setup({ engineSettings: { amazon: 'direct' } });

    expect(await loader.load(REF)).toEqual({ kind: 'unavailable', reason: 'no_engine' });
    expect(gateway.calls).toEqual([]);
  });

  it('never rejects when the store config cannot be read', async () => {
    const { loader, gateway } = setup({ storeConfigFails: true });

    expect(await loader.load(REF)).toEqual({ kind: 'unavailable', reason: 'store_config_error' });
    expect(gateway.calls).toEqual([]);
  });

  it('never rejects when the gateway breaks its contract', async () => {
    const { loader, gateway } = setup();
    gateway.getProduct = () => Promise.reject(new Error('boom'));

    expect(await loader.load(REF)).toEqual({ kind: 'unavailable', reason: 'error' });
  });

  it('counts the outcome', async () => {
    const { loader, observability } = setup();

    await loader.load(REF);
    await loader.load(null);

    expect(observability.metricsNamed('PdpScrapedOutcome').map((m) => m.dimensions)).toEqual([
      { Outcome: 'found' },
      { Outcome: 'unparsable_url' },
    ]);
  });
});
