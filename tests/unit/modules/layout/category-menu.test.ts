import { describe, expect, it } from 'vitest';
import { buildCategoryMenu, type CategoryNode } from '@/modules/layout/domain/category-menu';

const node = (
  name: string,
  position: number,
  overrides: Partial<CategoryNode> = {},
): CategoryNode => ({
  uid: name.toLowerCase(),
  name,
  urlPath: name.toLowerCase(),
  position,
  includeInMenu: true,
  children: [],
  ...overrides,
});

describe('buildCategoryMenu', () => {
  it('keeps only categories included in the menu, at every level', () => {
    const menu = buildCategoryMenu({
      categoryUrlSuffix: '.html',
      roots: [
        node('Hogar', 1, {
          children: [node('Cocina', 1), node('Oculta', 2, { includeInMenu: false })],
        }),
        node('Interna', 2, { includeInMenu: false }),
      ],
    });
    expect(menu.map((item) => item.label)).toEqual(['Hogar']);
    expect(menu[0]?.children.map((item) => item.label)).toEqual(['Cocina']);
  });

  it('orders siblings by position, keeping Magento order on ties', () => {
    const menu = buildCategoryMenu({
      categoryUrlSuffix: '',
      roots: [node('C', 3), node('A', 1), node('B1', 2), node('B2', 2)],
    });
    expect(menu.map((item) => item.label)).toEqual(['A', 'B1', 'B2', 'C']);
  });

  it('links every level to the legacy search and to the category url with the store suffix', () => {
    const [item] = buildCategoryMenu({
      categoryUrlSuffix: '.html',
      roots: [
        node('Electrónica', 1, {
          urlPath: 'electronica',
          children: [node('Audio', 1, { urlPath: 'electronica/audio' })],
        }),
      ],
    });
    expect(item).toMatchObject({
      id: 'electrónica',
      label: 'Electrónica',
      searchHref: '/search.html?query=electronica&store=amazon&page=1',
      categoryHref: '/electronica.html',
    });
    expect(item?.children[0]).toMatchObject({
      searchHref: '/search.html?query=electronica%2Faudio&store=amazon&page=1',
      categoryHref: '/electronica/audio.html',
    });
  });

  it('skips categories without a name or url path', () => {
    const menu = buildCategoryMenu({
      categoryUrlSuffix: '',
      roots: [node('', 1), node('Sin ruta', 2, { urlPath: '' }), node('Ok', 3)],
    });
    expect(menu.map((item) => item.label)).toEqual(['Ok']);
  });
});
