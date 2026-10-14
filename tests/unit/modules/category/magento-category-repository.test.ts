import { http, HttpResponse, type JsonBodyType } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoCategoryRepository } from '@/modules/category/infrastructure/magento-category-repository';
import { createMagentoClient } from '@/shared/graphql/client';
import laptops from '../../../fixtures/magento/category.laptops.json';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();
const [laptopsCategory] = laptops.data.categoryList;

const repository = () =>
  createMagentoCategoryRepository(
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

describe('MagentoCategoryRepository', () => {
  it('maps the category with its suffix and breadcrumbs ordered from the root', async () => {
    let body: { operationName?: string; query?: string; variables?: Record<string, unknown> } = {};
    server.use(
      http.post(URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json(laptops);
      }),
    );

    const category = await repository().findByUid('MTI=');

    expect(body.operationName).toBe('CategoryByUid');
    expect(body.variables).toEqual({ uid: 'MTI=' });
    expect(body.query).toMatch(/category_uid:\s*\{\s*eq:\s*\$uid\s*\}/);
    expect(category).toEqual({
      uid: 'MTI=',
      name: 'Laptops',
      description: '<p>Las mejores <strong>laptops</strong> al mejor precio.</p>',
      urlPath: 'electronica/computacion/laptops',
      urlSuffix: '.html',
      url: '/electronica/computacion/laptops.html',
      metaTitle: 'Laptops | Chupaprecios',
      metaDescription: 'Compra laptops importadas con envío a todo México.',
      breadcrumbs: [
        { uid: 'Mw==', name: 'Electrónica', url: '/electronica.html' },
        { uid: 'NQ==', name: 'Computación', url: '/electronica/computacion.html' },
      ],
    });
  });

  it('maps blank description and meta as null, no breadcrumbs as empty, no suffix as empty', async () => {
    respondWith({
      data: {
        storeConfig: { store_code: 'default', category_url_suffix: null },
        categoryList: [
          {
            ...laptopsCategory,
            url_path: 'ofertas',
            description: '  ',
            meta_title: null,
            meta_description: '',
            breadcrumbs: null,
          },
        ],
      },
    });

    await expect(repository().findByUid('MTI=')).resolves.toMatchObject({
      description: null,
      metaTitle: null,
      metaDescription: null,
      breadcrumbs: [],
      urlSuffix: '',
      url: '/ofertas',
    });
  });

  it('returns null when Magento lists no category for the uid', async () => {
    respondWith({ data: { storeConfig: laptops.data.storeConfig, categoryList: [] } });
    await expect(repository().findByUid('OTk5')).resolves.toBeNull();
  });

  it('returns null when Magento reports the category as missing', async () => {
    respondWith({
      errors: [{ message: "Category doesn't exist" }],
      data: { storeConfig: laptops.data.storeConfig, categoryList: null },
    });
    await expect(repository().findByUid('OTk5')).resolves.toBeNull();
  });

  it('rejects on an outage, so it is never rendered as a 404', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ message: 'down' }, { status: 503 })));
    await expect(repository().findByUid('MTI=')).rejects.toMatchObject({ kind: 'http' });
  });

  it('rejects on other GraphQL errors', async () => {
    respondWith({ errors: [{ message: 'Internal server error' }] });
    await expect(repository().findByUid('MTI=')).rejects.toMatchObject({ kind: 'graphql' });
  });

  it('rejects a null categoryList as an invalid response', async () => {
    respondWith({ data: { storeConfig: laptops.data.storeConfig, categoryList: null } });
    await expect(repository().findByUid('MTI=')).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('rejects a category without a url path or name as an invalid response', async () => {
    respondWith({
      data: { storeConfig: laptops.data.storeConfig, categoryList: [{ uid: 'MTI=', name: 'X' }] },
    });
    await expect(repository().findByUid('MTI=')).rejects.toMatchObject({
      kind: 'invalid_response',
    });

    respondWith({
      data: {
        storeConfig: laptops.data.storeConfig,
        categoryList: [{ ...laptopsCategory, name: ' ' }],
      },
    });
    await expect(repository().findByUid('MTI=')).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });
});
