import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOT_USER_AGENTS,
  DEFAULT_PRODUCT_VENDORS,
  parseServerEnv,
} from '@/shared/config/env';

const required = {
  MAGENTO_GRAPHQL_URL: 'https://magento.example.com/graphql',
  PUBLIC_BASE_URL: 'https://chupaprecios.com.mx',
  CHAPI_BASE_URL: 'https://chapi.example.com',
};

describe('parseServerEnv', () => {
  it('applies defaults when only required variables are set', () => {
    const env = parseServerEnv(required);

    expect(env).toEqual({
      ...required,
      MAGENTO_TIMEOUT_MS: 5000,
      CHAPI_TIMEOUT_MS: 15000,
      CHAPI_SEARCH_TIMEOUT_MS: 8000,
      COPY_MUTATION_TIMEOUT_MS: 10000,
      MAGENTO_MENU_TIMEOUT_MS: 1500,
      MAGENTO_STORE_CODE: 'default',
      MAGENTO_CURRENCY: 'MXN',
      BOT_USER_AGENTS: DEFAULT_BOT_USER_AGENTS,
      PRODUCT_VENDORS: DEFAULT_PRODUCT_VENDORS,
      LOG_LEVEL: 'info',
      METRICS_NAMESPACE: 'ChupaStorefront',
      ORGANIZATION_SAME_AS: [],
    });
  });

  it('includes the major crawlers and link-preview bots in the default list', () => {
    for (const bot of ['googlebot', 'bingbot', 'facebookexternalhit', 'whatsapp', 'twitterbot']) {
      expect(DEFAULT_BOT_USER_AGENTS).toContain(bot);
    }
  });

  it('coerces numeric timeouts from strings', () => {
    const env = parseServerEnv({
      ...required,
      MAGENTO_TIMEOUT_MS: '2500',
      CHAPI_TIMEOUT_MS: '20000',
      CHAPI_SEARCH_TIMEOUT_MS: '6000',
      COPY_MUTATION_TIMEOUT_MS: '7000',
      MAGENTO_MENU_TIMEOUT_MS: '900',
    });

    expect(env.MAGENTO_TIMEOUT_MS).toBe(2500);
    expect(env.CHAPI_TIMEOUT_MS).toBe(20000);
    expect(env.CHAPI_SEARCH_TIMEOUT_MS).toBe(6000);
    expect(env.COPY_MUTATION_TIMEOUT_MS).toBe(7000);
    expect(env.MAGENTO_MENU_TIMEOUT_MS).toBe(900);
  });

  it('reads the Magento store code and display currency', () => {
    const env = parseServerEnv({
      ...required,
      MAGENTO_STORE_CODE: ' es_mx ',
      MAGENTO_CURRENCY: 'usd',
    });

    expect(env.MAGENTO_STORE_CODE).toBe('es_mx');
    expect(env.MAGENTO_CURRENCY).toBe('USD');
  });

  it('rejects a currency that is not a three-letter ISO 4217 code', () => {
    expect(() => parseServerEnv({ ...required, MAGENTO_CURRENCY: 'pesos' })).toThrow(
      /MAGENTO_CURRENCY/,
    );
  });

  it('rejects non-positive or non-integer timeouts', () => {
    expect(() => parseServerEnv({ ...required, MAGENTO_TIMEOUT_MS: '0' })).toThrow(
      /MAGENTO_TIMEOUT_MS/,
    );
    expect(() => parseServerEnv({ ...required, CHAPI_TIMEOUT_MS: 'abc' })).toThrow(
      /CHAPI_TIMEOUT_MS/,
    );
    for (const value of ['0', '-1', '1.5', 'abc']) {
      expect(() => parseServerEnv({ ...required, CHAPI_SEARCH_TIMEOUT_MS: value })).toThrow(
        /CHAPI_SEARCH_TIMEOUT_MS/,
      );
    }
  });

  it('treats a blank search timeout as the 8000 ms default', () => {
    expect(
      parseServerEnv({ ...required, CHAPI_SEARCH_TIMEOUT_MS: ' ' }).CHAPI_SEARCH_TIMEOUT_MS,
    ).toBe(8000);
  });

  it('reports every missing required variable', () => {
    expect(() => parseServerEnv({})).toThrow(
      /MAGENTO_GRAPHQL_URL[\s\S]*PUBLIC_BASE_URL[\s\S]*CHAPI_BASE_URL/,
    );
  });

  it('rejects invalid URLs', () => {
    expect(() => parseServerEnv({ ...required, PUBLIC_BASE_URL: 'not a url' })).toThrow(
      /PUBLIC_BASE_URL/,
    );
  });

  it('strips a trailing slash from base URLs', () => {
    const env = parseServerEnv({ ...required, PUBLIC_BASE_URL: 'https://chupaprecios.com.mx/' });

    expect(env.PUBLIC_BASE_URL).toBe('https://chupaprecios.com.mx');
  });

  it('parses BOT_USER_AGENTS from comma or newline separated lists', () => {
    const env = parseServerEnv({
      ...required,
      BOT_USER_AGENTS: ' Googlebot, bingbot\nMy-Crawler\\/\\d+ ,,\n',
    });

    expect(env.BOT_USER_AGENTS).toEqual(['googlebot', 'bingbot', 'my-crawler\\/\\d+']);
  });

  it('falls back to the default bot list when BOT_USER_AGENTS is blank', () => {
    const env = parseServerEnv({ ...required, BOT_USER_AGENTS: '  ' });

    expect(env.BOT_USER_AGENTS).toEqual(DEFAULT_BOT_USER_AGENTS);
  });

  it('defaults PRODUCT_VENDORS to the phase 1 vendors', () => {
    expect(parseServerEnv(required).PRODUCT_VENDORS).toEqual(['amazon', 'ebay', 'target', 'acme']);
    expect(parseServerEnv({ ...required, PRODUCT_VENDORS: ' ' }).PRODUCT_VENDORS).toEqual(
      DEFAULT_PRODUCT_VENDORS,
    );
  });

  it('parses PRODUCT_VENDORS as a lowercase comma-separated list', () => {
    const env = parseServerEnv({ ...required, PRODUCT_VENDORS: ' Amazon, walmart ,,homedepot ' });

    expect(env.PRODUCT_VENDORS).toEqual(['amazon', 'walmart', 'homedepot']);
  });

  it('rejects PRODUCT_VENDORS entries that would break URL parsing', () => {
    expect(() => parseServerEnv({ ...required, PRODUCT_VENDORS: 'amazon,home-depot' })).toThrow(
      /PRODUCT_VENDORS/,
    );
    expect(() => parseServerEnv({ ...required, PRODUCT_VENDORS: 'amazon,foo bar' })).toThrow(
      /PRODUCT_VENDORS/,
    );
  });

  it('rejects unknown log levels', () => {
    expect(() => parseServerEnv({ ...required, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });

  it('treats empty strings as unset so defaults apply', () => {
    const env = parseServerEnv({ ...required, LOG_LEVEL: '', MAGENTO_TIMEOUT_MS: '' });

    expect(env.LOG_LEVEL).toBe('info');
    expect(env.MAGENTO_TIMEOUT_MS).toBe(5000);
  });

  it('reads the optional organization logo and social profiles', () => {
    const env = parseServerEnv({
      ...required,
      ORGANIZATION_LOGO_URL: 'https://chupaprecios.com.mx/media/logo/logo.png',
      ORGANIZATION_SAME_AS:
        ' https://www.facebook.com/chupaprecios , https://www.instagram.com/chupaprecios,',
    });

    expect(env.ORGANIZATION_LOGO_URL).toBe('https://chupaprecios.com.mx/media/logo/logo.png');
    expect(env.ORGANIZATION_SAME_AS).toEqual([
      'https://www.facebook.com/chupaprecios',
      'https://www.instagram.com/chupaprecios',
    ]);
  });

  it('rejects organization urls that are not http(s)', () => {
    expect(() => parseServerEnv({ ...required, ORGANIZATION_LOGO_URL: 'logo.png' })).toThrow(
      /ORGANIZATION_LOGO_URL/,
    );
    expect(() =>
      parseServerEnv({ ...required, ORGANIZATION_SAME_AS: 'https://ok.example.com,javascript:x' }),
    ).toThrow(/ORGANIZATION_SAME_AS/);
  });
});
