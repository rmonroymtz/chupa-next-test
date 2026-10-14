import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoCategoryProductsRepository } from '@/modules/category/infrastructure/magento-category-products-repository';
import { createMagentoClient } from '@/shared/graphql/client';
import page2 from '../../../fixtures/magento/category-products.laptops.page-2.json';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();
const QUERY = { categoryUid: 'MTI=', currentPage: 2, pageSize: 12 };

const repository = () =>
  createMagentoCategoryProductsRepository(
    createMagentoClient({
      url: URL,
      timeoutMs: 200,
      storeCode: 'default',
      currency: 'MXN',
      ...createCapturingObservability(),
    }),
  );

const respondWith = (data: JsonBodyType) =>
  server.use(http.post(URL, () => HttpResponse.json(data)));

describe('MagentoCategoryProductsRepository', () => {
  it('maps the requested page of products and its page info', async () => {
    let body: { operationName?: string; query?: string; variables?: Record<string, unknown> } = {};
    server.use(
      http.post(URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json(page2);
      }),
    );

    const result = await repository().findPage(QUERY);

    expect(body.operationName).toBe('CategoryProducts');
    expect(body.variables).toEqual({ uid: 'MTI=', currentPage: 2, pageSize: 12 });
    expect(body.query).toMatch(/category_uid:\s*\{\s*eq:\s*\$uid\s*\}/);
    expect(body.query).toMatch(/page_info\s*\{\s*current_page\s+page_size\s+total_pages\s*\}/);
    expect(result).toEqual({
      kind: 'page',
      page: {
        currentPage: 2,
        pageSize: 12,
        totalPages: 3,
        totalCount: 26,
        items: [
          {
            uid: 'MTAx',
            sku: 'ebay-1234567890',
            name: 'Laptop Lenovo IdeaPad 3 15.6"',
            urlKey: 'ebay-1234567890-laptop-lenovo-ideapad-3',
            relativeUrl: 'ebay-1234567890-laptop-lenovo-ideapad-3.html',
            image: {
              url: 'https://chupaprecios.com.mx/media/catalog/product/l/e/lenovo.jpg',
              label: 'Laptop Lenovo IdeaPad 3',
            },
            price: {
              final: { amount: 8999, currency: 'MXN' },
              regular: { amount: 9999, currency: 'MXN' },
              discount: { amountOff: 1000, percentOff: 10 },
            },
            availability: 'in_stock',
          },
          {
            uid: 'MTAy',
            sku: 'amazon-B0ABCDEF12',
            name: 'Laptop HP 14"',
            urlKey: 'amazon-B0ABCDEF12-laptop-hp-14',
            relativeUrl: 'amazon-B0ABCDEF12-laptop-hp-14.html',
            image: null,
            price: {
              final: { amount: 6500, currency: 'MXN' },
              regular: { amount: 6500, currency: 'MXN' },
              discount: { amountOff: 0, percentOff: 0 },
            },
            availability: 'out_of_stock',
          },
        ],
      },
    });
  });

  it('skips items Magento returns without the fields a product link needs', async () => {
    const [first] = page2.data.products.items;
    respondWith({
      data: {
        products: {
          ...page2.data.products,
          items: [null, { ...first, url_key: null }, { ...first, uid: 'MTAz' }],
        },
      },
    });

    const result = await repository().findPage(QUERY);

    expect(result.kind === 'page' && result.page.items.map((item) => item.uid)).toEqual(['MTAz']);
  });

  it('maps an empty category (Magento reports zero pages)', async () => {
    respondWith({
      data: {
        products: {
          total_count: 0,
          page_info: { current_page: 1, page_size: 12, total_pages: 0 },
          items: [],
        },
      },
    });

    await expect(repository().findPage({ ...QUERY, currentPage: 1 })).resolves.toEqual({
      kind: 'page',
      page: { items: [], currentPage: 1, pageSize: 12, totalPages: 0, totalCount: 0 },
    });
  });

  it('reports a page beyond the last one when Magento rejects the current page', async () => {
    respondWith({
      errors: [
        { message: 'currentPage value 9 specified is greater than the 3 page(s) available.' },
      ],
      data: { products: null },
    });

    await expect(repository().findPage({ ...QUERY, currentPage: 9 })).resolves.toEqual({
      kind: 'out_of_range',
    });
  });

  it('rejects on an outage, so it is never rendered as an empty category', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ message: 'down' }, { status: 503 })));
    await expect(repository().findPage(QUERY)).rejects.toMatchObject({ kind: 'http' });
  });

  it('rejects on other GraphQL errors', async () => {
    respondWith({ errors: [{ message: 'Internal server error' }] });
    await expect(repository().findPage(QUERY)).rejects.toMatchObject({ kind: 'graphql' });
  });

  it('rejects null products or a missing page info as an invalid response', async () => {
    respondWith({ data: { products: null } });
    await expect(repository().findPage(QUERY)).rejects.toMatchObject({
      kind: 'invalid_response',
    });

    respondWith({ data: { products: { ...page2.data.products, page_info: null } } });
    await expect(repository().findPage(QUERY)).rejects.toMatchObject({
      kind: 'invalid_response',
    });

    respondWith({ data: { products: { ...page2.data.products, total_count: null } } });
    await expect(repository().findPage(QUERY)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});
