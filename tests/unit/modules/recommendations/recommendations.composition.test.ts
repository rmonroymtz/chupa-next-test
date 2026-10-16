import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseServerEnv } from '@/shared/config/env';

const getLogger = vi.fn();
const getServerEnv = vi.fn();
const request = vi.fn();

vi.mock('@/shared/observability/logger', () => ({ getLogger: () => getLogger() }));
vi.mock('@/shared/config/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/config/env')>()),
  getServerEnv: () => getServerEnv(),
}));
vi.mock('@/shared/graphql/client', () => ({ getMagentoClient: () => ({ request }) }));

const { getRecommendations, DEFAULT_RECOMMENDATIONS_TIMEOUT_MS } =
  await import('@/modules/recommendations/infrastructure/recommendations.composition');

const required = {
  MAGENTO_GRAPHQL_URL: 'https://magento.example.com/graphql',
  PUBLIC_BASE_URL: 'https://chupaprecios.com.mx',
  CHAPI_BASE_URL: 'https://chapi.example.com',
};

describe('MAGENTO_RECOMMENDATIONS_TIMEOUT_MS', () => {
  it('is optional and coerced from a string', () => {
    expect(parseServerEnv(required).MAGENTO_RECOMMENDATIONS_TIMEOUT_MS).toBeUndefined();
    expect(
      parseServerEnv({ ...required, MAGENTO_RECOMMENDATIONS_TIMEOUT_MS: '1200' })
        .MAGENTO_RECOMMENDATIONS_TIMEOUT_MS,
    ).toBe(1200);
    expect(() =>
      parseServerEnv({ ...required, MAGENTO_RECOMMENDATIONS_TIMEOUT_MS: '-1' }),
    ).toThrow();
  });
});

describe('getRecommendations composition', () => {
  beforeEach(() => {
    getLogger.mockReset();
    getServerEnv.mockReset();
    request.mockReset();
  });

  it('asks Magento with the configured timeout and currency', async () => {
    getServerEnv.mockReturnValue({
      MAGENTO_RECOMMENDATIONS_TIMEOUT_MS: 900,
      MAGENTO_CURRENCY: 'USD',
    });
    request.mockResolvedValue({
      randomProducts: {
        products: [
          { sku: 'B1', name: 'Taladro', price: 10, regular_price: 0, link: 'amazon-B1-t.html' },
        ],
      },
    });

    const products = await getRecommendations('tendency');

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'GetRandomProducts',
        variables: { limit: 30, type: 'tendency' },
        timeoutMs: 900,
      }),
    );
    expect(products[0]?.price?.final).toEqual({ amount: 10, currency: 'USD' });
  });

  it('uses the default timeout when the variable is unset', async () => {
    getServerEnv.mockReturnValue({ MAGENTO_CURRENCY: 'MXN' });
    request.mockResolvedValue({ randomProducts: { products: [] } });

    await getRecommendations('recently');

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: DEFAULT_RECOMMENDATIONS_TIMEOUT_MS }),
    );
  });

  it('resolves to no products when configuration and the logger both fail', async () => {
    getServerEnv.mockImplementation(() => {
      throw new Error('invalid env');
    });
    getLogger.mockImplementation(() => {
      throw new Error('logger unavailable');
    });

    await expect(getRecommendations('also_bought')).resolves.toEqual([]);
  });

  it('logs a failure through the lazily created logger', async () => {
    const warn = vi.fn();
    getLogger.mockReturnValue({ child: () => ({ warn }) });
    getServerEnv.mockReturnValue({ MAGENTO_CURRENCY: 'MXN' });
    request.mockRejectedValue(new Error('down'));

    await expect(getRecommendations('tendency')).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tendency', err: expect.any(Error) }),
      'recommendations unavailable',
    );
  });
});
