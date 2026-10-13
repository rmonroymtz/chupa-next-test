import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoProductListRepository } from '@/modules/product/infrastructure/magento-product-list-repository';
import { createMagentoClient } from '@/shared/graphql/client';
import { setupMswServer } from '../../../../support/msw';
import { createCapturingObservability } from '../../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

const repository = () =>
  createMagentoProductListRepository(
    createMagentoClient({
      url: URL,
      timeoutMs: 200,
      storeCode: 'default',
      currency: 'MXN',
      ...createCapturingObservability(),
    }),
  );

const item = (urlKey: string, final: number, regular = final) => ({
  uid: `uid-${urlKey}`,
  sku: urlKey.toUpperCase(),
  name: `Product ${urlKey}`,
  url_key: urlKey,
  url_suffix: '.html',
  small_image: { url: `https://chupaprecios.com.mx/media/${urlKey}.jpg`, label: '' },
  stock_status: 'IN_STOCK',
  price_range: {
    minimum_price: {
      final_price: { value: final, currency: 'MXN' },
      regular_price: { value: regular, currency: 'MXN' },
      discount: { amount_off: regular - final, percent_off: 0 },
    },
  },
});

describe('MagentoProductListRepository.findByUrlKeys', () => {
  it('queries products by url key and keeps the requested order', async () => {
    let body: { operationName?: string; variables?: Record<string, unknown> } = {};
    server.use(
      http.post(URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({
          data: { products: { items: [item('b-2-y', 100), item('a-1-x', 899.5, 1299)] } },
        });
      }),
    );

    const cards = await repository().findByUrlKeys(['a-1-x', 'missing', 'b-2-y']);

    expect(body.operationName).toBe('ProductsByUrlKeys');
    expect(body.variables).toEqual({ urlKeys: ['a-1-x', 'missing', 'b-2-y'], pageSize: 3 });
    expect(cards.map((card) => card.relativeUrl)).toEqual(['a-1-x.html', 'b-2-y.html']);
    expect(cards[0]).toEqual({
      uid: 'uid-a-1-x',
      sku: 'A-1-X',
      name: 'Product a-1-x',
      urlKey: 'a-1-x',
      relativeUrl: 'a-1-x.html',
      image: { url: 'https://chupaprecios.com.mx/media/a-1-x.jpg', label: null },
      price: {
        final: { amount: 899.5, currency: 'MXN' },
        regular: { amount: 1299, currency: 'MXN' },
        discount: { amountOff: 399.5, percentOff: 0 },
      },
      availability: 'in_stock',
    });
  });

  it('does not call Magento for an empty list', async () => {
    await expect(repository().findByUrlKeys([])).resolves.toEqual([]);
  });

  it('rejects when Magento fails', async () => {
    server.use(http.post(URL, () => HttpResponse.json({}, { status: 500 })));
    await expect(repository().findByUrlKeys(['a'])).rejects.toMatchObject({ kind: 'http' });
  });
});
