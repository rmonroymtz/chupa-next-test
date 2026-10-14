import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCategoryCanonicalUrl,
  getCategoryPage,
} from '@/modules/category/infrastructure/category-page.composition';
import { resetServerEnvForTests } from '@/shared/config/env';
import laptops from '../../../fixtures/magento/category.laptops.json';
import productsPage from '../../../fixtures/magento/category-products.laptops.page-2.json';
import storeConfig from '../../../fixtures/magento/store-config.json';
import { setupMswServer } from '../../../support/msw';

/**
 * The real composition (repositories, store config, Magento client) against a
 * mocked Magento. Sharing one resolution between `generateMetadata` and the
 * page is React `cache()` inside a server request, so it is proven by the
 * integration suite (one Magento call per operation and request).
 */

const MAGENTO = 'https://magento.test/graphql';
/** Production and staging `grid_per_page` (Magento's default is 12). */
const GRID_PER_PAGE = 16;

const server = setupMswServer();
let productVariables: Record<string, unknown>[];

beforeEach(() => {
  vi.stubEnv('MAGENTO_GRAPHQL_URL', MAGENTO);
  vi.stubEnv('PUBLIC_BASE_URL', 'https://chupaprecios.com.mx');
  vi.stubEnv('CHAPI_BASE_URL', 'https://chapi.test');
  resetServerEnvForTests();
  productVariables = [];
  server.use(
    http.post(MAGENTO, async ({ request }) => {
      const body = (await request.json()) as {
        operationName: string;
        variables: Record<string, unknown>;
      };
      switch (body.operationName) {
        case 'StoreConfig':
          return HttpResponse.json({
            data: {
              storeConfig: { ...storeConfig.data.storeConfig, grid_per_page: GRID_PER_PAGE },
            },
          });
        case 'CategoryByUid':
          return HttpResponse.json(laptops);
        case 'CategoryProducts':
          productVariables.push(body.variables);
          return HttpResponse.json(productsPage);
        default:
          return HttpResponse.json({ errors: [{ message: 'unexpected' }] }, { status: 400 });
      }
    }),
  );
});

describe('getCategoryPage composition', () => {
  it("asks Magento for the requested page with the store's grid_per_page as page size", async () => {
    const resolution = await getCategoryPage('MTI=', 'page=2&utm_source=x');

    expect(productVariables).toEqual([{ uid: 'MTI=', currentPage: 2, pageSize: GRID_PER_PAGE }]);
    expect(resolution).toMatchObject({
      kind: 'page',
      category: { uid: 'MTI=', url: '/electronica/computacion/laptops.html' },
      canonicalPath: 'electronica/computacion/laptops.html',
      indexable: true,
    });
  });

  it('builds the canonical url from PUBLIC_BASE_URL and the clean category path', () => {
    expect(getCategoryCanonicalUrl('electronica/computacion/laptops.html')).toBe(
      'https://chupaprecios.com.mx/electronica/computacion/laptops.html',
    );
  });
});
