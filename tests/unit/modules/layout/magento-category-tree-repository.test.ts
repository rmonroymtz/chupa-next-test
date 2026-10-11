import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createMagentoCategoryTreeRepository } from '@/modules/layout/infrastructure/magento-category-tree-repository';
import { createMagentoClient } from '@/shared/graphql/client';
import { setupMswServer } from '../../../support/msw';
import { createCapturingObservability } from '../../../support/observability';

const URL = 'https://magento.test/graphql';
const server = setupMswServer();

function setup(menuTimeoutMs = 500) {
  const observability = createCapturingObservability();
  const repository = createMagentoCategoryTreeRepository(
    createMagentoClient({
      url: URL,
      timeoutMs: 5_000,
      storeCode: 'default',
      currency: 'MXN',
      ...observability,
    }),
    { timeoutMs: menuTimeoutMs },
  );
  return { repository, observability };
}

const category = (name: string, extra: Record<string, unknown> = {}) => ({
  uid: `uid-${name}`,
  name,
  include_in_menu: 1,
  position: 1,
  url_path: name.toLowerCase(),
  children: [],
  ...extra,
});

describe('MagentoCategoryTreeRepository', () => {
  it('reads the store root children and the category suffix in one HeaderMenu request', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(URL, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            storeConfig: { store_code: 'default', category_url_suffix: '.html' },
            categoryList: [
              {
                uid: 'root',
                name: 'Default Category',
                children: [
                  category('Hogar', {
                    position: 2,
                    children: [category('Cocina', { include_in_menu: 0, children: null })],
                  }),
                ],
              },
            ],
          },
        });
      }),
    );

    const tree = await setup().repository.getTree();

    expect(body.operationName).toBe('HeaderMenu');
    expect(tree).toEqual({
      categoryUrlSuffix: '.html',
      roots: [
        {
          uid: 'uid-Hogar',
          name: 'Hogar',
          urlPath: 'hogar',
          position: 2,
          includeInMenu: true,
          children: [
            {
              uid: 'uid-Cocina',
              name: 'Cocina',
              urlPath: 'cocina',
              position: 1,
              includeInMenu: false,
              children: [],
            },
          ],
        },
      ],
    });
  });

  it('tolerates a missing storeConfig suffix and an empty category list', async () => {
    server.use(
      http.post(URL, () => HttpResponse.json({ data: { storeConfig: null, categoryList: [] } })),
    );
    await expect(setup().repository.getTree()).resolves.toEqual({
      categoryUrlSuffix: '',
      roots: [],
    });
  });

  it('applies its own timeout and rejects (metered) when Magento is slow', async () => {
    server.use(
      http.post(URL, async () => {
        await delay(300);
        return HttpResponse.json({ data: { storeConfig: null, categoryList: [] } });
      }),
    );
    const { repository, observability } = setup(50);

    await expect(repository.getTree()).rejects.toMatchObject({ kind: 'timeout' });
    expect(observability.metricsNamed('MagentoError')[0]?.dimensions).toEqual({
      Operation: 'HeaderMenu',
      Kind: 'timeout',
    });
  });
});
