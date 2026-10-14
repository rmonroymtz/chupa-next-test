import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { resolveEngineId } from '@/modules/store-config/domain/store-config';
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

  it('rejects when Magento returns a null storeConfig', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ data: { storeConfig: null } })));

    await expect(repository().get()).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});
