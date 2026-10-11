import { describe, expect, it, vi } from 'vitest';
import { loadCategoryMenu } from '@/modules/layout/application/load-category-menu';

const logger = () => ({ warn: vi.fn() });

describe('loadCategoryMenu', () => {
  it('maps the category tree into menu items', async () => {
    const log = logger();
    const menu = await loadCategoryMenu({
      categories: {
        getTree: async () => ({
          categoryUrlSuffix: '.html',
          roots: [
            {
              uid: 'MQ==',
              name: 'Hogar',
              urlPath: 'hogar',
              position: 1,
              includeInMenu: true,
              children: [],
            },
          ],
        }),
      },
      logger: log,
    });
    expect(menu.map((item) => item.label)).toEqual(['Hogar']);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('an adapter failure yields an empty menu and is logged, never thrown', async () => {
    const log = logger();
    const error = new Error('Magento down');
    const menu = await loadCategoryMenu({
      categories: { getTree: () => Promise.reject(error) },
      logger: log,
    });
    expect(menu).toEqual([]);
    expect(log.warn).toHaveBeenCalledWith({ err: error }, 'header menu unavailable');
  });

  it('a synchronous adapter failure (e.g. invalid configuration) also yields an empty menu', async () => {
    const log = logger();
    const menu = await loadCategoryMenu({
      categories: {
        getTree: () => {
          throw new Error('Invalid server environment');
        },
      },
      logger: log,
    });
    expect(menu).toEqual([]);
    expect(log.warn).toHaveBeenCalledOnce();
  });
});
