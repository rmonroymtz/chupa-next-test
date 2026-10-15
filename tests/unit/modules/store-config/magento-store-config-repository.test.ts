import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { resolveEngineId, resolveSearchEngineId } from '@/modules/store-config/domain/store-config';
import { createMagentoStoreConfigRepository } from '@/modules/store-config/infrastructure/magento-store-config-repository';
import { createMagentoClient } from '@/shared/graphql/client';
import fixture from '../../../fixtures/magento/store-config.json';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

const repository = () =>
  createMagentoStoreConfigRepository(
    createMagentoClient({
      url: URL,
      timeoutMs: 200,
      storeCode: 'default',
      currency: 'MXN',
      ...createCapturingObservability(),
    }),
  );

describe('MagentoStoreConfigRepository', () => {
  it('maps the recorded storeConfig and resolves the eBay engine', async () => {
    server.use(http.post(URL, () => HttpResponse.json(fixture)));

    const config = await repository().get();

    expect(config.productUrlSuffix).toBe('.html');
    expect(resolveEngineId('ebay', config.engineRouting)).toBe('api');
  });

  it('selects the configured home CMS page', async () => {
    let query = '';
    server.use(
      http.post(URL, async ({ request }) => {
        query = String(((await request.json()) as { query?: unknown }).query);
        return HttpResponse.json({
          data: { storeConfig: { ...fixture.data.storeConfig, cms_home_page: 'venia-new-home' } },
        });
      }),
    );

    const config = await repository().get();

    expect(query).toMatch(/\bcms_home_page\b/);
    expect(config.cmsHomePage).toBe('venia-new-home');
  });

  it('selects the category grid page size', async () => {
    let query = '';
    server.use(
      http.post(URL, async ({ request }) => {
        query = String(((await request.json()) as { query?: unknown }).query);
        return HttpResponse.json({
          data: { storeConfig: { ...fixture.data.storeConfig, grid_per_page: 24 } },
        });
      }),
    );

    const config = await repository().get();

    expect(query).toMatch(/\bgrid_per_page\b/);
    expect(config.gridPerPage).toBe(24);
  });

  it('selects the search engines separately from the product engines', async () => {
    let query = '';
    server.use(
      http.post(URL, async ({ request }) => {
        query = String(((await request.json()) as { query?: unknown }).query);
        return HttpResponse.json({
          data: {
            storeConfig: {
              ...fixture.data.storeConfig,
              engine_settings: {
                ...fixture.data.storeConfig.engine_settings,
                // Values recorded from staging (2026-10-15).
                acme_search_engine: 'direct',
                amazon_search_engine: 'direct',
                ebay_search_engine: 'api',
                homedepot_search_engine: 'bigbox',
                target_search_engine: 'direct',
                walmart_search_engine: 'direct',
              },
            },
          },
        });
      }),
    );

    const config = await repository().get();

    for (const store of ['acme', 'amazon', 'ebay', 'homedepot', 'target', 'walmart']) {
      expect(query).toMatch(new RegExp(`\\b${store}_engine\\b`));
      expect(query).toMatch(new RegExp(`\\b${store}_search_engine\\b`));
    }
    expect(resolveSearchEngineId('ebay', config.engineRouting)).toBe('api');
    // homedepot falls back to amazon's search engine, as in the legacy storefront.
    expect(resolveSearchEngineId('homedepot', config.engineRouting)).toBe('direct');
    expect(resolveEngineId('ebay', config.engineRouting)).toBe('api');
  });

  it('rejects when Magento returns a null storeConfig', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ data: { storeConfig: null } })));

    await expect(repository().get()).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});
