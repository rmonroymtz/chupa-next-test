import { describe, expect, it } from 'vitest';
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
});
