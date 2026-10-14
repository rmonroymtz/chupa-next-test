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

  it('links every level to its category page with the store suffix, never to the search page', () => {
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
      categoryHref: '/electronica.html',
    });
    expect(item?.children[0]).toMatchObject({ categoryHref: '/electronica/audio.html' });
    expect(item).not.toHaveProperty('searchHref');
    expect(item?.children[0]).not.toHaveProperty('searchHref');
  });

  it('skips categories without a name or url path', () => {
    const menu = buildCategoryMenu({
      categoryUrlSuffix: '',
      roots: [node('', 1), node('Sin ruta', 2, { urlPath: '' }), node('Ok', 3)],
    });
    expect(menu.map((item) => item.label)).toEqual(['Ok']);
  });

  it('derives a stable id from the url path when Magento sends no uid', () => {
    const menu = buildCategoryMenu({
      categoryUrlSuffix: '',
      roots: [
        node('A', 1, { uid: '', urlPath: 'a' }),
        node('B', 2, {
          uid: '',
          urlPath: 'b',
          children: [node('C', 1, { uid: '', urlPath: 'b/c' })],
        }),
      ],
    });
    expect(menu.map((item) => item.id)).toEqual(['path:a', 'path:b']);
    expect(menu[1]?.children[0]?.id).toBe('path:b/c');
  });

  it('never yields duplicate ids: later repeats of a category are dropped', () => {
    const menu = buildCategoryMenu({
      categoryUrlSuffix: '',
      roots: [
        node('A', 1, { uid: 'MQ==' }),
        node('A bis', 2, { uid: 'MQ==' }),
        node('Sin uid', 3, { uid: '', urlPath: 'x' }),
        node('Sin uid bis', 4, { uid: '', urlPath: 'x' }),
      ],
    });
    expect(menu.map((item) => item.label)).toEqual(['A', 'Sin uid']);
  });
});
