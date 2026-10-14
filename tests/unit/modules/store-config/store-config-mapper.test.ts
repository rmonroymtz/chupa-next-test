import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_PER_PAGE } from '@/modules/store-config/domain/store-config';
import { mapStoreConfig } from '@/modules/store-config/infrastructure/store-config-mapper';
import fixture from '../../../fixtures/magento/store-config.json';

describe('mapStoreConfig', () => {
  it('maps the recorded storeConfig payload', () => {
    const config = mapStoreConfig(fixture.data.storeConfig);

    expect(config).toEqual({
      storeCode: 'default',
      storeName: 'Chupaprecios',
      locale: 'es_MX',
      productUrlSuffix: '.html',
      baseMediaUrl: 'https://chupaprecios.com.mx/media/',
      baseCurrencyCode: 'USD',
      displayCurrencyCode: 'MXN',
      defaultTitle: 'Chupaprecios | Explora comprar sin fronteras.',
      titlePrefix: null,
      titleSuffix: null,
      titleSeparator: '-',
      defaultDescription: null,
      // The recording predates the cms_home_page field.
      cmsHomePage: null,
      // The recording predates the grid_per_page field.
      gridPerPage: 12,
      engineRouting: {
        engineSettings: {
          amazon: 'direct',
          ebay: 'api',
          acme: 'direct',
          target: 'direct',
          walmart: 'direct',
          homedepot: 'direct',
        },
        serviceFallback: {
          amazon: 'amazon',
          ebay: 'ebay',
          acme: 'acme',
          target: 'target',
          walmart: 'walmart',
          homedepot: 'amazon',
        },
      },
    });
  });

  it('defaults the suffix to .html and tolerates missing engine settings', () => {
    const config = mapStoreConfig({
      store_code: 'default',
      product_url_suffix: null,
      engine_settings: null,
      service_fallback: null,
    });

    expect(config.productUrlSuffix).toBe('.html');
    expect(config.engineRouting).toEqual({ engineSettings: {}, serviceFallback: {} });
    expect(config.storeName).toBeNull();
  });

  it('prefers the secure media url', () => {
    const config = mapStoreConfig({
      base_media_url: 'http://cdn.test/media/',
      secure_base_media_url: 'https://cdn.test/media/',
    });

    expect(config.baseMediaUrl).toBe('https://cdn.test/media/');
  });

  it('maps the configured home CMS page identifier, blank as null', () => {
    expect(mapStoreConfig({ cms_home_page: ' venia-new-home ' }).cmsHomePage).toBe(
      'venia-new-home',
    );
    expect(mapStoreConfig({ cms_home_page: '  ' }).cmsHomePage).toBeNull();
    expect(mapStoreConfig({ cms_home_page: null }).cmsHomePage).toBeNull();
  });

  it('keeps only the identifier when Magento stores the home page as identifier|page_id', () => {
    // Magento appends `|page_id` when the identifier is not unique across stores.
    expect(mapStoreConfig({ cms_home_page: 'venia-new-home|5' }).cmsHomePage).toBe(
      'venia-new-home',
    );
    expect(mapStoreConfig({ cms_home_page: ' venia-new-home |5' }).cmsHomePage).toBe(
      'venia-new-home',
    );
    expect(mapStoreConfig({ cms_home_page: ' |5' }).cmsHomePage).toBeNull();
  });

  it('maps the category grid page size', () => {
    expect(mapStoreConfig({ grid_per_page: 24 }).gridPerPage).toBe(24);
  });

  it('falls back to a page size of 12 when Magento returns no usable grid_per_page', () => {
    expect(DEFAULT_GRID_PER_PAGE).toBe(12);
    expect(mapStoreConfig({ grid_per_page: null }).gridPerPage).toBe(12);
    expect(mapStoreConfig({}).gridPerPage).toBe(12);
    expect(mapStoreConfig({ grid_per_page: 0 }).gridPerPage).toBe(12);
    expect(mapStoreConfig({ grid_per_page: -3 }).gridPerPage).toBe(12);
    expect(mapStoreConfig({ grid_per_page: 2.5 }).gridPerPage).toBe(12);
  });
});
