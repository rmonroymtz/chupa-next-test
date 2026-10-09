import { afterEach, describe, expect, it, vi } from 'vitest';
import { getServerEnv, resetServerEnvForTests } from '@/shared/config/env';

describe('getServerEnv', () => {
  afterEach(() => {
    resetServerEnvForTests();
  });

  it('parses process.env lazily and memoizes the result', () => {
    vi.stubEnv('MAGENTO_GRAPHQL_URL', 'https://magento.example.com/graphql');
    vi.stubEnv('PUBLIC_BASE_URL', 'https://chupaprecios.com.mx');
    vi.stubEnv('CHAPI_BASE_URL', 'https://chapi.example.com');

    const first = getServerEnv();
    vi.stubEnv('LOG_LEVEL', 'debug');
    const second = getServerEnv();

    expect(second).toBe(first);
    expect(second.LOG_LEVEL).toBe('info');
  });

  it('throws a descriptive error when required variables are missing', () => {
    vi.stubEnv('MAGENTO_GRAPHQL_URL', '');
    vi.stubEnv('PUBLIC_BASE_URL', '');
    vi.stubEnv('CHAPI_BASE_URL', '');

    expect(() => getServerEnv()).toThrow(/Invalid server environment/);
  });
});
